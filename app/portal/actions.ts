"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AuthRateLimitError,
  enforceAuthRateLimit,
  getAuth,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";
import { breachedPasswordProblem } from "@/lib/breached-passwords";
import { acceptInvitation, InvitationError } from "@/lib/invitations";
import { safeAuthenticatedPath } from "@/lib/permissions";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const unavailable: AuthFormState = {
  status: "error",
  message: "Sign-in is temporarily unavailable. Please try again shortly.",
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function passwordProblem(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Keep your password under ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirmation) return "The two passwords do not match.";
  return null;
}

/** Applies the shared limit and turns its failures into form messages. */
async function limited(
  requestHeaders: Headers,
  email?: string,
): Promise<AuthFormState | null> {
  try {
    await enforceAuthRateLimit(requestHeaders, email);
    return null;
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      return { status: "error", message: error.message };
    }
    console.error("[auth] rate limiting unavailable:", error);
    return unavailable;
  }
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const next = safeAuthenticatedPath(field(formData, "next"));

  if (!emailPattern.test(email) || !password) {
    return {
      status: "error",
      message: "Enter your email address and password.",
    };
  }

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders, email);
  if (blocked) return blocked;

  try {
    await getAuth().api.signInEmail({
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

  redirect(next);
}

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/portal/sign-in");
}

export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  if (!emailPattern.test(email)) {
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

  redirect("/portal");
}
