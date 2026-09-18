import "server-only";

import { createHash } from "node:crypto";

import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

import { getDb } from "@/lib/db";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  type EmailDelivery,
} from "@/lib/email";
import {
  identifierFromHeaders,
  ServiceConfigurationError,
} from "@/lib/forms-services";
import { breachedPasswordProblem } from "@/lib/breached-passwords";
import { authSecretProblem } from "@/lib/production-config";
import { requireUserVerification } from "@/lib/passkey-policy";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  recordPasswordChanged,
  recordPasswordResetRequested,
  recordRateLimited,
  recordSignIn,
  recordSignInFailure,
  recordTwoFactorFailure,
  type SignInFailure,
} from "@/lib/security-events";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

const AUTH_WINDOW_SECONDS = 15 * 60;
const AUTH_ATTEMPT_LIMIT = 10;

// Endpoints that set a new password: refused if it appears in a breach.
const newPasswordPaths = new Set(["/reset-password", "/change-password"]);

// Endpoints that accept credentials or send email over HTTP.
const rateLimitedPaths = new Set([
  "/sign-in/email",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/two-factor/enable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/generate-backup-codes",
]);

/** Every passkey request goes through the portal's server actions. */
const passkeyPaths = [
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/passkey/list-user-passkeys",
  "/passkey/update-passkey",
  "/passkey/delete-passkey",
];

/** An authenticator code works once, however long its window lasts. */
const TOTP_REUSE_WINDOW_MS = 90 * 1000;
export const TOTP_REUSED_MESSAGE =
  "That code was already used. Wait for the next one.";

function usedCodeKey(userId: string, code: string): string {
  return `totp-used-${userId}-${code}`;
}

type AuthHookContext = Parameters<
  Parameters<typeof createAuthMiddleware>[0]
>[0];

/** Whose sign-in a pending two-factor challenge belongs to, if any. */
async function pendingTwoFactorUser(
  context: AuthHookContext,
): Promise<string | null> {
  const cookie = context.context.createAuthCookie("two_factor");
  const identifier = await context.getSignedCookie(
    cookie.name,
    context.context.secret,
  );
  if (!identifier) return null;
  const challenge =
    await context.context.internalAdapter.findVerificationValue(identifier);
  return challenge?.value ?? null;
}

export class AuthRateLimitError extends Error {
  constructor(readonly retryAfter: number) {
    super("Too many attempts. Please wait before trying again.");
  }
}

/**
 * Specification 10.4: sign-in is limited to 10 attempts per 15 minutes per IP
 * address and per email address, using the shared distributed limiter.
 */
export async function enforceAuthRateLimit(
  headers: Headers,
  email?: string,
): Promise<void> {
  const checks = [
    checkRateLimit({
      scope: "auth-ip",
      identifier: identifierFromHeaders(headers),
      limit: AUTH_ATTEMPT_LIMIT,
      windowSeconds: AUTH_WINDOW_SECONDS,
    }),
  ];
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    checks.push(
      checkRateLimit({
        scope: "auth-email",
        identifier: createHash("sha256")
          .update(normalizedEmail)
          .digest("hex")
          .slice(0, 32),
        limit: AUTH_ATTEMPT_LIMIT,
        windowSeconds: AUTH_WINDOW_SECONDS,
      }),
    );
  }

  const blocked = (await Promise.all(checks)).find(
    (decision) => !decision.allowed,
  );
  if (blocked) {
    if (normalizedEmail) await recordRateLimited(normalizedEmail, headers);
    throw new AuthRateLimitError(blocked.retryAfter);
  }
}

/** Which kind of refusal a failed email sign-in was, if one worth recording. */
function signInFailure(returned: unknown): SignInFailure | null {
  if (!(returned instanceof APIError)) return null;
  const code = (returned.body as { code?: unknown } | undefined)?.code;
  if (code === "EMAIL_NOT_VERIFIED") return "unverified";
  if (code === "FAILED_TO_CREATE_SESSION") return "suspended";
  return returned.statusCode === 401 ? "password" : null;
}

/**
 * Without an email provider (local development only; production requires
 * one), print account links so the flow can still be completed.
 */
export function logUndeliveredLink(
  purpose: string,
  email: string,
  url: string,
  mode: EmailDelivery["mode"],
): void {
  if (mode !== "development-bypass" || process.env.NODE_ENV === "production") {
    return;
  }
  console.info(`[auth] ${purpose} link for ${email}: ${url}`);
}

function createAuth() {
  const secretProblem = authSecretProblem(
    process.env.BETTER_AUTH_SECRET,
    process.env,
  );
  if (secretProblem) {
    throw new ServiceConfigurationError("Better Auth", secretProblem);
  }

  const siteURL = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL)
    : null;

  return betterAuth({
    appName: "SANDHI Research Lab",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      // Accounts are created only by accepting an invitation.
      disableSignUp: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        await recordPasswordResetRequested(user.id, request?.headers);
        const delivery = await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          url,
        });
        logUndeliveredLink("password reset", user.email, url, delivery.mode);
      },
      onPasswordReset: async ({ user }, request) => {
        await recordPasswordChanged(user, request?.headers);
      },
    },
    emailVerification: {
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        const delivery = await sendVerificationEmail({
          to: user.email,
          name: user.name,
          url,
        });
        logUndeliveredLink(
          "email verification",
          user.email,
          url,
          delivery.mode,
        );
      },
    },
    verification: {
      // Reset links are stored only as SHA-256 hashes, so reading the
      // database never yields a working link.
      storeIdentifier: "hashed",
    },
    user: {
      additionalFields: {
        // Assigned by invitations and administrators only, never by the user.
        role: {
          type: "string",
          required: false,
          defaultValue: "MEMBER",
          input: false,
        },
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    // Better Auth's own limiter stores counts per instance; the shared limiter
    // in the hook below is enforced across serverless instances instead.
    rateLimit: { enabled: false },
    disabledPaths: [
      "/sign-up/email",
      "/update-user",
      "/change-email",
      "/delete-user",
      // Turning two-factor off goes through the portal, which refuses it
      // for staff; the secret is never read back; codes are not emailed.
      "/two-factor/disable",
      "/two-factor/get-totp-uri",
      "/two-factor/send-otp",
      "/two-factor/verify-otp",
      // Passkeys need the password to add one; the portal checks it first.
      ...passkeyPaths,
    ],
    hooks: {
      before: createAuthMiddleware(async (context) => {
        const body = context.body as
          | { email?: unknown; newPassword?: unknown; code?: unknown }
          | undefined;

        // Server actions call the API directly and limit themselves; this
        // covers requests that reach the HTTP endpoints.
        if (context.request && rateLimitedPaths.has(context.path)) {
          try {
            await enforceAuthRateLimit(
              context.request.headers,
              typeof body?.email === "string" ? body.email : undefined,
            );
          } catch (error) {
            if (error instanceof AuthRateLimitError) {
              throw new APIError("TOO_MANY_REQUESTS", {
                message: error.message,
              });
            }
            throw error;
          }
        }

        if (
          newPasswordPaths.has(context.path) &&
          typeof body?.newPassword === "string"
        ) {
          const problem = await breachedPasswordProblem(body.newPassword);
          if (problem) {
            throw new APIError("BAD_REQUEST", {
              message: problem,
              code: "PASSWORD_BREACHED",
            });
          }
        }

        if (
          context.path === "/two-factor/verify-totp" &&
          typeof body?.code === "string"
        ) {
          const userId = await pendingTwoFactorUser(context);
          const used = userId
            ? await context.context.internalAdapter.findVerificationValue(
                usedCodeKey(userId, body.code),
              )
            : null;
          if (used && new Date(used.expiresAt).getTime() > Date.now()) {
            throw new APIError("UNAUTHORIZED", {
              message: TOTP_REUSED_MESSAGE,
              code: "TOTP_CODE_REUSED",
            });
          }
        }
      }),
      after: createAuthMiddleware(async (context) => {
        if (
          (context.path === "/two-factor/verify-totp" ||
            context.path === "/two-factor/verify-backup-code") &&
          context.context.returned instanceof APIError
        ) {
          const userId = await pendingTwoFactorUser(context);
          if (userId) {
            await recordTwoFactorFailure(
              userId,
              context.headers ?? context.request?.headers,
            );
          }
          return;
        }
        if (context.path === "/two-factor/verify-totp") {
          const returned = context.context.returned as
            { user?: { id?: unknown } } | undefined;
          const code = (context.body as { code?: unknown } | undefined)?.code;
          if (
            !(returned instanceof APIError) &&
            typeof returned?.user?.id === "string" &&
            typeof code === "string"
          ) {
            await context.context.internalAdapter.createVerificationValue({
              identifier: usedCodeKey(returned.user.id, code),
              value: returned.user.id,
              expiresAt: new Date(Date.now() + TOTP_REUSE_WINDOW_MS),
            });
          }
          return;
        }
        if (context.path !== "/sign-in/email") return;
        const reason = signInFailure(context.context.returned);
        const body = context.body as { email?: unknown } | undefined;
        if (!reason || typeof body?.email !== "string") return;
        await recordSignInFailure(
          body.email,
          reason,
          context.headers ?? context.request?.headers,
        );
      }),
    },
    databaseHooks: {
      session: {
        create: {
          // A suspended member cannot start a session, however they sign in.
          before: async (session) => {
            const member = await getDb().member.findUnique({
              where: { userId: session.userId },
              select: { status: true },
            });
            if (member?.status === "SUSPENDED") return false;
          },
          after: async (session, context) => {
            // Replacing the session of someone already signed in is not a
            // sign-in, nor is the password-only session that two-factor
            // sign-in discards before asking for the code.
            const current = (
              context?.context as { session?: unknown } | undefined
            )?.session;
            if (current) return;
            if (context?.path === "/sign-in/email") {
              const user = await getDb().user.findUnique({
                where: { id: session.userId },
                select: { twoFactorEnabled: true },
              });
              if (user?.twoFactorEnabled) return;
            }
            await recordSignIn(session);
          },
        },
      },
    },
    telemetry: { enabled: false },
    // Must stay last: lets server actions set the session cookie.
    plugins: [
      // Authenticator-app codes with encrypted secrets and backup codes. A
      // challenge allows five tries; ten failures lock two-factor sign-in
      // for fifteen minutes.
      twoFactor({ issuer: "SANDHI Research Lab" }),
      passkey({
        rpName: "SANDHI Research Lab",
        // Production pins the site's own address; development uses the
        // request's (localhost), since WebAuthn refuses IP addresses.
        ...(siteURL ? { rpID: siteURL.hostname, origin: siteURL.origin } : {}),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        registration: {
          afterVerification: ({ verification }) => {
            requireUserVerification(
              verification.registrationInfo?.userVerified,
            );
          },
        },
        authentication: {
          afterVerification: ({ verification }) => {
            requireUserVerification(
              verification.authenticationInfo.userVerified,
            );
          },
        },
      }),
      nextCookies(),
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

/** Created on first use so builds and pages without a database never load it. */
export function getAuth(): ReturnType<typeof createAuth> {
  auth ??= createAuth();
  return auth;
}
