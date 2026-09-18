import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/research",
  "/join",
  "/publications",
  "/contact",
  "/portal/sign-in",
] as const;

function nonceFrom(policy: string | undefined): string | undefined {
  return policy?.match(/'nonce-([^']+)'/u)?.[1];
}

test("pages send a strict per-request policy and the standard security headers", async ({
  request,
}) => {
  const first = await request.get("/");
  const second = await request.get("/");
  const headers = first.headers();
  const policy = headers["content-security-policy"];

  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
  expect(nonceFrom(policy)).toBeTruthy();
  expect(nonceFrom(policy)).not.toBe(
    nonceFrom(second.headers()["content-security-policy"]),
  );

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");

  const api = await request.get("/api/graph");
  expect(api.headers()["x-content-type-options"]).toBe("nosniff");
});

for (const path of pages) {
  test(`${path} runs without Content Security Policy violations`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const violations: string[] = [];
      Object.assign(window, { __cspViolations: violations });
      document.addEventListener("securitypolicyviolation", (event) => {
        violations.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });

    const response = await page.goto(path);
    const nonce = nonceFrom(response?.headers()["content-security-policy"]);
    await expect(page.locator("h1").first()).toBeVisible();
    // The inline theme script runs only because it carries the same nonce.
    expect(
      await page.evaluate(
        () =>
          document.querySelector<HTMLScriptElement>("head script:not([src])")
            ?.nonce,
      ),
    ).toBe(nonce);

    if (path === "/join") {
      await page
        .getByRole("radio", { name: /research collaboration/i })
        .check();
      await page.getByRole("button", { name: "Continue" }).click();
    }
    // Let lazy chunks (the WebGL field, map signals, form widgets) load.
    await page.waitForTimeout(3_000);

    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __cspViolations: string[] }).__cspViolations,
      ),
    ).toEqual([]);
  });
}

test("form endpoints refuse requests from other sites", async ({ request }) => {
  const crossSite = {
    headers: {
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    // Well-formed, so each endpoint reaches its origin check.
    data: { email: "someone@example.org", password: "not-a-real-password" },
  };

  for (const endpoint of [
    "/api/contact",
    "/api/join",
    "/api/join/upload",
    "/api/events/any-event/register",
    "/api/auth/sign-in/email",
  ]) {
    const response = await request.post(endpoint, crossSite);
    expect(response.status(), endpoint).toBe(403);
  }
});

test("security.txt tells researchers where to report a vulnerability", async ({
  request,
}) => {
  const response = await request.get("/.well-known/security.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");

  const text = await response.text();
  expect(text).toMatch(/^Contact: mailto:\S+@\S+$/mu);
  const expires = new Date(/^Expires: (.+)$/mu.exec(text)![1]!);
  expect(expires.getTime()).toBeGreaterThan(Date.now());
  expect(expires.getTime() - Date.now()).toBeLessThan(
    365 * 24 * 60 * 60 * 1000,
  );
  expect(text).toMatch(/^Canonical: \S+\/\.well-known\/security\.txt$/mu);
});
