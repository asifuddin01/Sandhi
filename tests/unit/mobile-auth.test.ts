import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  AuthRateLimitError: class AuthRateLimitError extends Error {},
  enforceAuthRateLimit: vi.fn(),
}));

import { readSignInOutcome, viewerPayload } from "@/lib/api/mobile-auth";
import type { Viewer } from "@/lib/authz";

function headers(entries: Array<[string, string]>): Headers {
  const value = new Headers();
  for (const [name, item] of entries) value.append(name, item);
  return value;
}

describe("readSignInOutcome", () => {
  it("returns the bearer token and when it expires", () => {
    const outcome = readSignInOutcome(
      headers([
        ["set-auth-token", "token.signature"],
        [
          "set-cookie",
          "better-auth.session_token=token.signature; Path=/; HttpOnly; Max-Age=604800",
        ],
      ]),
    );
    expect(outcome).toMatchObject({
      status: "signed-in",
      token: "token.signature",
    });
    expect(
      new Date((outcome as { expiresAt: string }).expiresAt).getTime(),
    ).toBeGreaterThan(Date.now());
  });

  it("returns a challenge when a code is still needed", () => {
    const outcome = readSignInOutcome(
      headers([
        [
          "set-cookie",
          "better-auth.two_factor=challenge.signature; Path=/; HttpOnly; Max-Age=600",
        ],
      ]),
    );
    expect(outcome).toEqual({
      status: "two-factor",
      challenge: expect.any(String),
    });
    // The challenge never carries the token in the clear.
    expect((outcome as { challenge: string }).challenge).not.toContain(
      "two_factor",
    );
  });

  /**
   * Better Auth creates a session, clears it, and asks for a code — and the
   * bearer plugin still stamps the discarded token onto the response. Trusting
   * that header would hand the app a token that fails on its first request.
   */
  it("asks for a code even when the discarded session's token is still stamped on", () => {
    const outcome = readSignInOutcome(
      headers([
        ["set-auth-token", "discarded.signature"],
        [
          "set-cookie",
          "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=lax",
        ],
        [
          "set-cookie",
          "better-auth.session_data=; Path=/; Max-Age=0; HttpOnly; SameSite=lax",
        ],
        [
          "set-cookie",
          "better-auth.two_factor=2fa-ozdfpZT4niUTTN7TKP6r.Vu0nt10g%2BQ%3D; Path=/; Max-Age=600; HttpOnly; SameSite=lax",
        ],
      ]),
    );
    expect(outcome).toMatchObject({ status: "two-factor" });
  });

  it("takes the last value when one response sets a cookie twice", () => {
    expect(
      readSignInOutcome(
        headers([
          ["set-cookie", "better-auth.session_token=first; Max-Age=600"],
          ["set-cookie", "better-auth.session_token=second; Max-Age=600"],
        ]),
      ),
    ).toMatchObject({ token: "second" });
  });

  it("falls back to the cookie when the token header is absent", () => {
    expect(
      readSignInOutcome(
        headers([
          [
            "set-cookie",
            "better-auth.session_token=token.sig%2Bnature; Path=/; Max-Age=604800",
          ],
        ]),
      ),
    ).toMatchObject({ status: "signed-in", token: "token.sig+nature" });
  });

  it("reports nothing when neither a session nor a challenge was set", () => {
    expect(readSignInOutcome(headers([]))).toBeNull();
    expect(
      readSignInOutcome(headers([["set-cookie", "unrelated=1; Path=/"]])),
    ).toBeNull();
    // A token header on its own establishes nothing.
    expect(
      readSignInOutcome(headers([["set-auth-token", "token.signature"]])),
    ).toBeNull();
  });
});

describe("viewerPayload", () => {
  const viewer = (role: Viewer["role"]): Viewer => ({
    userId: "user-1",
    sessionId: "session-1",
    sessionCreatedAt: new Date("2026-09-19T06:00:00.000Z"),
    email: "person@sandhi.test",
    name: "A Person",
    role,
    twoFactorEnabled: role !== "MEMBER",
    member: {
      id: "member-1",
      slug: "a-person",
      name: "A Person",
      rank: "RESEARCHER",
      status: "ACTIVE",
    },
  });

  it("lists only the capabilities the role actually holds", () => {
    expect(viewerPayload(viewer("MEMBER")).capabilities).toEqual([
      "portal:access",
    ]);

    const reviewer = viewerPayload(viewer("REVIEWER")).capabilities;
    expect(reviewer).toContain("admin:access");
    expect(reviewer).toContain("publications:publish");
    expect(reviewer).not.toContain("members:manage");
    expect(reviewer).not.toContain("ownership:transfer");

    expect(viewerPayload(viewer("OWNER")).capabilities).toContain(
      "ownership:transfer",
    );
  });

  it("never includes the session token, only its identity and age", () => {
    const payload = viewerPayload(viewer("ADMIN"));
    expect(payload.session).toEqual({
      id: "session-1",
      createdAt: "2026-09-19T06:00:00.000Z",
    });
    expect(JSON.stringify(payload)).not.toContain("token");
  });
});
