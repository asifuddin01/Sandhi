import { APIError } from "better-auth/api";

import { decodeTwoFactorChallenge } from "@/lib/api/auth-cookies";
import { ApiError } from "@/lib/api/errors";
import { apiRoute, readApiJson } from "@/lib/api/handler";
import {
  authErrorCode,
  limitAuthAttempt,
  readSignInOutcome,
} from "@/lib/api/mobile-auth";
import { getAuth, TOTP_REUSED_MESSAGE } from "@/lib/auth";
import { recordBackupCodeUsed } from "@/lib/security-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const messages: Record<string, string> = {
  INVALID_CODE: "That code is not correct.",
  INVALID_BACKUP_CODE: "That backup code is not correct or was already used.",
  TOTP_CODE_REUSED: TOTP_REUSED_MESSAGE,
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE:
    "Too many attempts. Sign in again to try once more.",
  ACCOUNT_TEMPORARILY_LOCKED:
    "Too many incorrect codes. Two-factor sign-in is paused for 15 minutes.",
  INVALID_TWO_FACTOR_COOKIE: "This sign-in has expired. Sign in again.",
};

/** The second step: the challenge from sign-in, plus a code. */
export const POST = apiRoute({}, async ({ request }) => {
  const body = (await readApiJson(request)) as {
    challenge?: unknown;
    code?: unknown;
    method?: unknown;
  };

  const method = body.method === "backup" ? "backup" : "totp";
  const raw = typeof body.code === "string" ? body.code : "";
  const code = method === "totp" ? raw.replace(/\s/gu, "") : raw.trim();

  if (method === "totp" && !/^\d{6}$/u.test(code)) {
    throw ApiError.badRequest(
      "Enter the six-digit code from your authenticator app.",
    );
  }
  if (method === "backup" && !/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/u.test(code)) {
    throw ApiError.badRequest(
      "Enter one of your backup codes, including the dash.",
    );
  }

  const cookie = decodeTwoFactorChallenge(body.challenge);
  if (!cookie) {
    throw ApiError.badRequest("This sign-in has expired. Sign in again.");
  }

  await limitAuthAttempt(request.headers);

  // Only the pending challenge is replayed; nothing else the client sent can
  // reach the Cookie header.
  const headers = new Headers(request.headers);
  headers.set("cookie", cookie);

  let responseHeaders: Headers;
  try {
    if (method === "totp") {
      ({ headers: responseHeaders } = await getAuth().api.verifyTOTP({
        body: { code },
        headers,
        returnHeaders: true,
      }));
    } else {
      const verified = await getAuth().api.verifyBackupCode({
        body: { code },
        headers,
        returnHeaders: true,
      });
      responseHeaders = verified.headers;
      await recordBackupCodeUsed(verified.response.user, headers);
    }
  } catch (error) {
    if (error instanceof APIError) {
      const code = authErrorCode(error);
      throw ApiError.unauthenticated(
        (code && messages[code]) ||
          "That code could not be checked. Sign in again.",
      );
    }
    throw error;
  }

  const outcome = readSignInOutcome(responseHeaders);
  if (!outcome || outcome.status !== "signed-in") {
    throw new ApiError(
      "server_error",
      "Sign-in did not complete. Please try again.",
    );
  }
  return outcome;
});
