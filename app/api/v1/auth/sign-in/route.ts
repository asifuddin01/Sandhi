import { APIError } from "better-auth/api";

import { ApiError } from "@/lib/api/errors";
import { apiRoute, readApiJson } from "@/lib/api/handler";
import {
  authErrorCode,
  limitAuthAttempt,
  readSignInOutcome,
} from "@/lib/api/mobile-auth";
import { getAuth } from "@/lib/auth";
import { isEmailAddress } from "@/lib/email-address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sign-in for clients without a cookie jar. It runs exactly the flow the
 * portal's server action runs — the same limiter, the same neutral messages,
 * the same suspended-member and unverified-email refusals — and returns the
 * session as a bearer token instead of a cookie.
 */
export const POST = apiRoute({}, async ({ request }) => {
  const body = (await readApiJson(request)) as {
    email?: unknown;
    password?: unknown;
  };
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!isEmailAddress(email) || !password) {
    throw ApiError.badRequest("Enter your email address and password.");
  }

  await limitAuthAttempt(request.headers, email);

  let headers: Headers;
  try {
    ({ headers } = await getAuth().api.signInEmail({
      body: { email, password },
      headers: request.headers,
      returnHeaders: true,
    }));
  } catch (error) {
    if (error instanceof APIError) {
      // Raised only once the password matched, so it reveals nothing to
      // someone guessing addresses.
      if (authErrorCode(error) === "FAILED_TO_CREATE_SESSION") {
        throw new ApiError(
          "forbidden",
          "Sign-in did not complete. If this continues, contact an administrator.",
        );
      }
      if (error.statusCode === 401) {
        throw ApiError.unauthenticated(
          "The email address or password is incorrect.",
        );
      }
      if (error.statusCode === 403) {
        throw new ApiError(
          "forbidden",
          "Confirm your email address first. We have sent you a new link.",
          { reason: "email_unverified" },
        );
      }
    }
    throw error;
  }

  const outcome = readSignInOutcome(headers);
  if (!outcome) {
    throw new ApiError(
      "server_error",
      "Sign-in did not complete. Please try again.",
    );
  }
  return outcome;
});
