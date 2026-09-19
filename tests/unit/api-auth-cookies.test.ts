import { describe, expect, it } from "vitest";

import {
  cookieLifetimeSeconds,
  decodeTwoFactorChallenge,
  encodeTwoFactorChallenge,
  isSessionCookieName,
  isTwoFactorCookieName,
  parseSetCookie,
  parseSetCookies,
} from "@/lib/api/auth-cookies";

// Made-up values, written so a secret scanner reads them as the fixtures they
// are: the real cookie is signed by Better Auth and never appears in a test.
const CHALLENGE_VALUE = "fixture-challenge.fixture-signature";
const challengeCookie = `better-auth.two_factor=${CHALLENGE_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;

describe("parseSetCookie", () => {
  it("reads the pair and lower-cases the attribute names", () => {
    expect(parseSetCookie(challengeCookie)).toEqual({
      name: "better-auth.two_factor",
      value: CHALLENGE_VALUE,
      attributes: {
        path: "/",
        httponly: "",
        samesite: "Lax",
        "max-age": "600",
      },
    });
  });

  it("refuses a header with no name", () => {
    expect(parseSetCookie("=value")).toBeNull();
    expect(parseSetCookie("novalue")).toBeNull();
  });

  it("skips what it cannot parse rather than failing the batch", () => {
    expect(parseSetCookies(["broken", challengeCookie])).toHaveLength(1);
  });
});

describe("cookie names", () => {
  it("recognises the two-factor and session cookies under any prefix", () => {
    expect(isTwoFactorCookieName("better-auth.two_factor")).toBe(true);
    expect(isTwoFactorCookieName("__Secure-better-auth.two_factor")).toBe(true);
    expect(isSessionCookieName("__Secure-better-auth.session_token")).toBe(
      true,
    );
  });

  it("does not mistake another cookie for them", () => {
    expect(isTwoFactorCookieName("two_factor_notes")).toBe(false);
    expect(isSessionCookieName("better-auth.two_factor")).toBe(false);
  });
});

describe("cookieLifetimeSeconds", () => {
  it("prefers Max-Age and falls back to Expires", () => {
    const parsed = parseSetCookie(challengeCookie)!;
    expect(cookieLifetimeSeconds(parsed)).toBe(600);

    const expires = parseSetCookie(
      `s=1; Expires=${new Date(Date.now() + 120_000).toUTCString()}`,
    )!;
    expect(cookieLifetimeSeconds(expires)).toBeGreaterThan(100);
  });

  it("returns null for a cookie that has already expired or says nothing", () => {
    expect(cookieLifetimeSeconds(parseSetCookie("s=1; Path=/")!)).toBeNull();
    expect(cookieLifetimeSeconds(parseSetCookie("s=1; Max-Age=0")!)).toBeNull();
  });
});

describe("the two-factor challenge round trip", () => {
  it("comes back as the Cookie header it started as", () => {
    const encoded = encodeTwoFactorChallenge(parseSetCookie(challengeCookie)!);
    expect(encoded).not.toContain("two_factor");
    expect(decodeTwoFactorChallenge(encoded)).toBe(
      `better-auth.two_factor=${CHALLENGE_VALUE}`,
    );
  });

  it("refuses anything that is not a single two-factor cookie", () => {
    const forge = (raw: string) => Buffer.from(raw).toString("base64url");

    // A different cookie: a session token must never be replayed this way.
    expect(
      decodeTwoFactorChallenge(forge("better-auth.session_token=stolen")),
    ).toBeNull();
    // Header injection, by separator or by newline.
    expect(
      decodeTwoFactorChallenge(
        forge("better-auth.two_factor=a; better-auth.session_token=b"),
      ),
    ).toBeNull();
    expect(
      decodeTwoFactorChallenge(forge("better-auth.two_factor=a\r\nHost: x")),
    ).toBeNull();
    // Not base64url, empty, or absurdly long.
    expect(decodeTwoFactorChallenge("not base64!")).toBeNull();
    expect(decodeTwoFactorChallenge("")).toBeNull();
    expect(decodeTwoFactorChallenge("A".repeat(9000))).toBeNull();
    expect(decodeTwoFactorChallenge(42)).toBeNull();
  });
});
