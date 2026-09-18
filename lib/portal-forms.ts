import "server-only";

import {
  AuthRateLimitError,
  enforceAuthRateLimit,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";

/** Shared by the portal's server actions (sign-in, reset, account security). */
export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const unavailable: AuthFormState = {
  status: "error",
  message: "Sign-in is temporarily unavailable. Please try again shortly.",
};

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function passwordProblem(
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
export async function limited(
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
