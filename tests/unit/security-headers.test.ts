import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "@/lib/forms-http";
import {
  buildContentSecurityPolicy,
  staticSecurityHeaders,
} from "@/lib/security-headers";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name!, values];
    }),
  );
}

describe("content security policy", () => {
  it("allows only nonce-bearing scripts and never embeds or frames the site", () => {
    const policy = directives(
      buildContentSecurityPolicy({
        nonce: "abc123",
        isDevelopment: false,
        upgradeInsecureRequests: true,
        env: {} as NodeJS.ProcessEnv,
      }),
    );

    expect(policy.get("script-src")).toEqual([
      "'self'",
      "'nonce-abc123'",
      "'strict-dynamic'",
      "https://challenges.cloudflare.com",
    ]);
    expect(policy.get("script-src")).not.toContain("'unsafe-inline'");
    expect(policy.get("script-src")).not.toContain("'unsafe-eval'");
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.get("connect-src")).toEqual([
      "'self'",
      "https://challenges.cloudflare.com",
    ]);
    expect(policy.has("upgrade-insecure-requests")).toBe(true);
  });

  it("adds development allowances only in development and HTTPS upgrades only over HTTPS", () => {
    const policy = directives(
      buildContentSecurityPolicy({
        nonce: "dev",
        isDevelopment: true,
        upgradeInsecureRequests: false,
        env: {} as NodeJS.ProcessEnv,
      }),
    );

    expect(policy.get("script-src")).toContain("'unsafe-eval'");
    expect(policy.get("connect-src")).toContain("ws:");
    expect(policy.has("upgrade-insecure-requests")).toBe(false);
  });

  it("allows exactly the configured storage origins", () => {
    const policy = directives(
      buildContentSecurityPolicy({
        nonce: "n",
        isDevelopment: false,
        upgradeInsecureRequests: true,
        env: {
          R2_ACCOUNT_ID: "a1b2c3",
          R2_PUBLIC_BASE_URL: "https://files.sandhiresearch.org/public/",
        } as unknown as NodeJS.ProcessEnv,
      }),
    );

    expect(policy.get("connect-src")).toContain(
      "https://a1b2c3.r2.cloudflarestorage.com",
    );
    expect(policy.get("img-src")).toContain("https://files.sandhiresearch.org");

    const unsafe = directives(
      buildContentSecurityPolicy({
        nonce: "n",
        isDevelopment: false,
        upgradeInsecureRequests: true,
        env: {
          R2_ACCOUNT_ID: "bad host; script-src *",
          R2_PUBLIC_BASE_URL: "http://files.example.org",
        } as unknown as NodeJS.ProcessEnv,
      }),
    );
    expect(unsafe.get("connect-src")).toEqual([
      "'self'",
      "https://challenges.cloudflare.com",
    ]);
    expect(unsafe.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  it("sends HSTS only from production builds", () => {
    const keys = (isProduction: boolean) =>
      staticSecurityHeaders(isProduction).map((header) => header.key);

    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(keys(false)).not.toContain("Strict-Transport-Security");
    expect(keys(false)).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});

describe("same-origin form requests", () => {
  const post = (headers: Record<string, string>) =>
    new Request("https://sandhiresearch.org/api/join", {
      method: "POST",
      headers,
    });
  const production = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

  it("accepts the site's own origin and refuses other sites", () => {
    expect(
      isSameOriginRequest(
        post({ origin: "https://sandhiresearch.org" }),
        production,
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(post({ origin: "https://evil.example" }), production),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        post({
          origin: "https://sandhiresearch.org",
          "sec-fetch-site": "cross-site",
        }),
        production,
      ),
    ).toBe(false);
    expect(isSameOriginRequest(post({ origin: "null" }), production)).toBe(
      false,
    );
  });

  it("requires an origin in production only", () => {
    expect(isSameOriginRequest(post({}), production)).toBe(false);
    expect(
      isSameOriginRequest(post({}), { NODE_ENV: "test" } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});
