import { ApiError } from "@/lib/api/errors";
import { apiRoute, readApiJson } from "@/lib/api/handler";
import { limitAuthAttempt } from "@/lib/api/mobile-auth";
import { getAuth } from "@/lib/auth";
import { isEmailAddress } from "@/lib/email-address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sends the same reset link the website sends. The link opens in a browser:
 * resets are deliberately one web flow, so there is one place where a new
 * password is checked against the breach list.
 */
export const POST = apiRoute({}, async ({ request }) => {
  const body = (await readApiJson(request)) as { email?: unknown };
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmailAddress(email)) {
    throw ApiError.badRequest("Enter a valid email address.");
  }

  await limitAuthAttempt(request.headers, email);

  try {
    await getAuth().api.requestPasswordReset({
      body: { email, redirectTo: "/portal/reset-password" },
      headers: request.headers,
    });
  } catch (error) {
    console.error("[api] password reset request failed:", error);
  }

  // The same answer whether or not the account exists.
  return {
    sent: true,
    message:
      "If an account uses that address, we have sent a link to reset its password.",
  };
});
