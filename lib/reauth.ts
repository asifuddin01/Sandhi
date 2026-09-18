import "server-only";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";

import { AuthRateLimitError, enforceAuthRateLimit, getAuth } from "@/lib/auth";
import type { Viewer } from "@/lib/authz";
import { recordSecurityEvent } from "@/lib/security-events";

export class ReauthenticationError extends Error {}

/**
 * Sensitive actions ask for the password again, so a session left open or
 * stolen cannot transfer the lab or remove people on its own. Attempts share
 * the sign-in rate limit, so this cannot be used to guess the password.
 */
export async function confirmPassword(
  viewer: Viewer,
  password: string,
): Promise<void> {
  if (!password) {
    throw new ReauthenticationError("Enter your password to confirm.");
  }

  const requestHeaders = await headers();
  try {
    await enforceAuthRateLimit(requestHeaders, viewer.email);
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      throw new ReauthenticationError(error.message);
    }
    throw error;
  }

  try {
    await getAuth().api.verifyPassword({
      body: { password },
      headers: requestHeaders,
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    await recordSecurityEvent(
      "auth.reauth_failed",
      viewer.userId,
      {},
      requestHeaders,
    );
    throw new ReauthenticationError("That password is not correct.");
  }
}
