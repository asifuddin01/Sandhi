import "server-only";

import { APIError } from "better-auth/api";

import {
  cookieIsSet,
  cookieLifetimeSeconds,
  encodeTwoFactorChallenge,
  isSessionCookieName,
  isTwoFactorCookieName,
  lastCookie,
  parseSetCookies,
} from "@/lib/api/auth-cookies";
import { ApiError } from "@/lib/api/errors";
import { AuthRateLimitError, enforceAuthRateLimit } from "@/lib/auth";
import type { Viewer } from "@/lib/authz";
import { can, capabilityRoles, type Capability } from "@/lib/permissions";

/** The header the bearer plugin adds, carrying the signed session token. */
export const SESSION_TOKEN_HEADER = "set-auth-token";

export interface IssuedSession {
  /** Send as `Authorization: Bearer <token>`; store it in the keychain. */
  token: string;
  expiresAt: string | null;
}

export interface PendingTwoFactor {
  /** Return this with the code; it is opaque and short-lived. */
  challenge: string;
}

/**
 * What Better Auth did with the credentials, read from the response headers it
 * would have sent to a browser.
 */
export type SignInOutcome =
  | ({ status: "signed-in" } & IssuedSession)
  | ({ status: "two-factor" } & PendingTwoFactor);

/**
 * The session cookie decides, not the `set-auth-token` header: two-factor
 * sign-in creates a session, clears it again, and asks for a code, and the
 * header can still carry the token of the session that was just discarded.
 */
export function readSignInOutcome(headers: Headers): SignInOutcome | null {
  const cookies = parseSetCookies(headers.getSetCookie());

  const session = lastCookie(cookies, isSessionCookieName);
  if (cookieIsSet(session)) {
    const lifetime = cookieLifetimeSeconds(session);
    return {
      status: "signed-in",
      // The header carries the token undecoded; the cookie percent-encodes it.
      token:
        headers.get(SESSION_TOKEN_HEADER) ?? decodeURIComponent(session.value),
      expiresAt: lifetime
        ? new Date(Date.now() + lifetime * 1000).toISOString()
        : null,
    };
  }

  const challenge = lastCookie(cookies, isTwoFactorCookieName);
  return cookieIsSet(challenge)
    ? { status: "two-factor", challenge: encodeTwoFactorChallenge(challenge) }
    : null;
}

/** Applies the shared sign-in limiter and states the wait in API terms. */
export async function limitAuthAttempt(
  headers: Headers,
  email?: string,
): Promise<void> {
  try {
    await enforceAuthRateLimit(headers, email);
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      throw new ApiError("rate_limited", error.message, {
        retryAfter: error.retryAfter,
      });
    }
    throw error;
  }
}

/** The error body code Better Auth attached, when it attached one. */
export function authErrorCode(error: unknown): string | null {
  if (!(error instanceof APIError)) return null;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : null;
}

export interface ViewerPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  twoFactorEnabled: boolean;
  member: {
    id: string;
    slug: string;
    name: string;
    rank: string;
    status: string;
  } | null;
  /** Every capability this viewer holds, so the app can hide what it cannot do. */
  capabilities: Capability[];
  session: { id: string; createdAt: string };
}

/**
 * The viewer as the app sees it. Capabilities are advisory: the app uses them
 * to lay out its navigation, and every route still authorizes on the server.
 */
export function viewerPayload(viewer: Viewer): ViewerPayload {
  return {
    id: viewer.userId,
    email: viewer.email,
    name: viewer.name,
    role: viewer.role,
    twoFactorEnabled: viewer.twoFactorEnabled,
    member: viewer.member,
    capabilities: (Object.keys(capabilityRoles) as Capability[]).filter(
      (capability) => can(viewer.role, capability),
    ),
    session: {
      id: viewer.sessionId,
      createdAt: viewer.sessionCreatedAt.toISOString(),
    },
  };
}
