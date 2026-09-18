import "server-only";

import { createHash } from "node:crypto";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

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
import { checkRateLimit } from "@/lib/ratelimit";
import {
  recordPasswordChanged,
  recordPasswordResetRequested,
  recordRateLimited,
  recordSignIn,
  recordSignInFailure,
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
]);

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
    ],
    hooks: {
      before: createAuthMiddleware(async (context) => {
        const body = context.body as
          { email?: unknown; newPassword?: unknown } | undefined;

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
      }),
      after: createAuthMiddleware(async (context) => {
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
          after: async (session) => {
            await recordSignIn(session);
          },
        },
      },
    },
    telemetry: { enabled: false },
    // Must stay last: lets server actions set the session cookie.
    plugins: [nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

/** Created on first use so builds and pages without a database never load it. */
export function getAuth(): ReturnType<typeof createAuth> {
  auth ??= createAuth();
  return auth;
}
