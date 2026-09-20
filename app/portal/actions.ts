"use server";

import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth, TOTP_REUSED_MESSAGE } from "@/lib/auth";
import { breachedPasswordProblem } from "@/lib/breached-passwords";
import { isEmailAddress } from "@/lib/email-address";
import { recordBackupCodeUsed } from "@/lib/security-events";
import { acceptInvitation, InvitationError } from "@/lib/invitations";
import { safeAuthenticatedPath } from "@/lib/permissions";
import {
  field,
  limited,
  passwordProblem,
  unavailable,
  type AuthFormState,
} from "@/lib/portal-forms";

export type { AuthFormState } from "@/lib/portal-forms";

/**
 * The site header, the mobile menu and the footer all say something different
 * once somebody is signed in, and they live in the root layout. A client
 * navigation reuses the layout it already has, so signing in or out has to
 * mark it stale — otherwise the header keeps offering "Sign in" to someone
 * who has just signed in.
 */
function refreshChrome(): void {
  revalidatePath("/", "layout");
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const next = safeAuthenticatedPath(field(formData, "next"));

  if (!isEmailAddress(email) || !password) {
    return {
      status: "error",
      message: "Enter your email address and password.",
    };
  }

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders, email);
  if (blocked) return blocked;

  let result: unknown;
  try {
    result = await getAuth().api.signInEmail({
      body: { email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      // Raised only after the password matched, when the session is refused
      // (a suspended member), so it reveals nothing to someone guessing.
      if (error.body?.code === "FAILED_TO_CREATE_SESSION") {
        return {
          status: "error",
          message:
            "Sign-in did not complete. If this continues, contact an administrator.",
        };
      }
      if (error.statusCode === 401) {
        return {
          status: "error",
          message: "The email address or password is incorrect.",
        };
      }
      if (error.statusCode === 403) {
        return {
          status: "error",
          message:
            "Confirm your email address first. We have sent you a new link.",
        };
      }
      return {
        status: "error",
        message:
          "Sign-in did not complete. If this continues, contact an administrator.",
      };
    }
    console.error("[auth] sign-in failed:", error);
    return unavailable;
  }

  // The password was right; accounts with two-factor authentication still
  // need a code before a session exists.
  if (
    result &&
    typeof result === "object" &&
    "twoFactorRedirect" in result &&
    result.twoFactorRedirect
  ) {
    refreshChrome();
    redirect(`/portal/two-factor?next=${encodeURIComponent(next)}`);
  }
  refreshChrome();
  redirect(next);
}

const twoFactorMessages: Record<string, string> = {
  INVALID_CODE: "That code is not correct.",
  INVALID_BACKUP_CODE: "That backup code is not correct or was already used.",
  TOTP_CODE_REUSED: TOTP_REUSED_MESSAGE,
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:
    "Too many attempts. Sign in again to try once more.",
  ACCOUNT_TEMPORARILY_LOCKED:
    "Too many incorrect codes. Two-factor sign-in is paused for 15 minutes.",
  INVALID_TWO_FACTOR_COOKIE: "This sign-in has expired. Sign in again.",
};

/** The second step: a code from the authenticator app, or a backup code. */
export async function verifyTwoFactorAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const method = field(formData, "method") === "backup" ? "backup" : "totp";
  const next = safeAuthenticatedPath(field(formData, "next"));
  const code =
    method === "totp"
      ? field(formData, "code").replace(/\s/gu, "")
      : field(formData, "code").trim();

  if (method === "totp" && !/^\d{6}$/u.test(code)) {
    return {
      status: "error",
      message: "Enter the six-digit code from your authenticator app.",
    };
  }
  if (method === "backup" && !/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/u.test(code)) {
    return {
      status: "error",
      message: "Enter one of your backup codes, including the dash.",
    };
  }

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders);
  if (blocked) return blocked;

  try {
    if (method === "totp") {
      await getAuth().api.verifyTOTP({
        body: { code },
        headers: requestHeaders,
      });
    } else {
      const result = await getAuth().api.verifyBackupCode({
        body: { code },
        headers: requestHeaders,
      });
      await recordBackupCodeUsed(result.user, requestHeaders);
    }
  } catch (error) {
    if (error instanceof APIError) {
      const errorCode = (error.body as { code?: unknown } | undefined)?.code;
      return {
        status: "error",
        message:
          (typeof errorCode === "string" && twoFactorMessages[errorCode]) ||
          "That code could not be checked. Sign in again.",
      };
    }
    console.error("[auth] two-factor verification failed:", error);
    return unavailable;
  }

  refreshChrome();
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  refreshChrome();
  redirect("/portal/sign-in");
}

export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  if (!isEmailAddress(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders, email);
  if (blocked) return blocked;

  try {
    await getAuth().api.requestPasswordReset({
      body: { email, redirectTo: "/portal/reset-password" },
      headers: requestHeaders,
    });
  } catch (error) {
    console.error("[auth] password reset request failed:", error);
  }

  // The same answer whether or not the account exists.
  return {
    status: "success",
    message:
      "If an account uses that address, we have sent a link to reset its password.",
  };
}

export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = field(formData, "token");
  const password = field(formData, "password");
  const problem = passwordProblem(password, field(formData, "confirmation"));
  if (problem) return { status: "error", message: problem };
  if (!token) {
    return {
      status: "error",
      message: "This reset link is not valid. Request a new one.",
    };
  }

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders);
  if (blocked) return blocked;

  try {
    await getAuth().api.resetPassword({
      body: { newPassword: password, token },
      headers: requestHeaders,
    });
  } catch (error) {
    if (!(error instanceof APIError)) {
      console.error("[auth] password reset failed:", error);
    } else if (
      (error.body as { code?: unknown } | undefined)?.code ===
      "PASSWORD_BREACHED"
    ) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message:
        "This reset link has expired or was already used. Request a new one.",
    };
  }

  return {
    status: "success",
    message: "Your password has been changed. You can sign in with it now.",
  };
}

export async function acceptInvitationAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = field(formData, "token");
  const name = field(formData, "name").trim().replace(/\s+/gu, " ");
  const password = field(formData, "password");

  if (name.length < 2 || name.length > 120) {
    return { status: "error", message: "Enter your full name." };
  }
  const problem = passwordProblem(password, field(formData, "confirmation"));
  if (problem) return { status: "error", message: problem };

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders);
  if (blocked) return blocked;

  const breached = await breachedPasswordProblem(password);
  if (breached) return { status: "error", message: breached };

  let email: string;
  try {
    ({ email } = await acceptInvitation({ token, name, password }));
  } catch (error) {
    if (error instanceof InvitationError) {
      return { status: "error", message: error.message };
    }
    console.error("[auth] invitation acceptance failed:", error);
    return unavailable;
  }

  try {
    await getAuth().api.signInEmail({
      body: { email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    console.error("[auth] sign-in after invitation failed:", error);
    redirect("/portal/sign-in");
  }

  refreshChrome();
  redirect("/portal");
}

export type PasskeySignInStart =
  { status: "error"; message: string } | { status: "ready"; options: unknown };

const passkeySignInMessages: Record<string, string> = {
  PASSKEY_NOT_FOUND:
    "This passkey is not registered for SANDHI. Sign in with your password.",
  AUTHENTICATION_FAILED: "That passkey could not be verified.",
  CHALLENGE_NOT_FOUND: "That took too long. Try again.",
  // A suspended member's session is refused.
  UNABLE_TO_CREATE_SESSION:
    "Sign-in did not complete. If this continues, contact an administrator.",
};

export async function beginPasskeySignInAction(): Promise<PasskeySignInStart> {
  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders);
  if (blocked) return { status: "error", message: blocked.message! };
  try {
    const options = await getAuth().api.generatePasskeyAuthenticationOptions({
      headers: requestHeaders,
    });
    return { status: "ready", options };
  } catch (error) {
    console.error("[auth] passkey sign-in options failed:", error);
    return { status: "error", message: unavailable.message! };
  }
}

export async function finishPasskeySignInAction(input: {
  response: AuthenticationResponseJSON;
  next: string;
}): Promise<AuthFormState> {
  const next = safeAuthenticatedPath(input.next);
  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders);
  if (blocked) return blocked;

  try {
    await getAuth().api.verifyPasskeyAuthentication({
      body: { response: input.response },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      const code = (error.body as { code?: unknown } | undefined)?.code;
      if (code === "PASSKEY_USER_NOT_VERIFIED") {
        return { status: "error", message: error.message };
      }
      return {
        status: "error",
        message:
          (typeof code === "string" && passkeySignInMessages[code]) ||
          "Passkey sign-in did not complete. Sign in with your password.",
      };
    }
    console.error("[auth] passkey sign-in failed:", error);
    return unavailable;
  }

  refreshChrome();
  redirect(next);
}
