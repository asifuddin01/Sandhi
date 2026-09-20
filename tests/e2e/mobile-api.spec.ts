import { expect, test, type APIRequestContext } from "@playwright/test";

import { PASSWORD, twoFactorSecret } from "./support/auth";
import { totp } from "./support/totp";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

const CLIENT = "sandhi-e2e/1.0.0 (android; build=1)";

async function body(response: { json: () => Promise<unknown> }) {
  return (await response.json()) as {
    data?: Record<string, unknown>;
    error?: { code: string; message: string; details?: unknown };
    meta?: { apiVersion: number };
  };
}

function signIn(
  request: APIRequestContext,
  email: string,
  password = PASSWORD,
) {
  return request.post("/api/v1/auth/sign-in", {
    headers: { "x-sandhi-client": CLIENT },
    data: { email, password },
  });
}

test.describe("the public API mirrors the public site", () => {
  const collections = [
    "/api/v1/home",
    "/api/v1/research",
    "/api/v1/projects",
    "/api/v1/publications",
    "/api/v1/people",
    "/api/v1/news",
    "/api/v1/insights",
    "/api/v1/resources",
    "/api/v1/opportunities",
    "/api/v1/graph",
    "/api/v1/settings",
  ] as const;

  for (const path of collections) {
    test(`${path} answers in the shared envelope, with no client header`, async ({
      request,
    }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const payload = await body(response);
      expect(payload.meta).toEqual({ apiVersion: 1 });
      expect(payload.data).toBeDefined();
      expect(payload.error).toBeUndefined();
      expect(response.headers()["cache-control"]).toContain("public");
    });
  }

  test("a record the public site shows is a record the API shows", async ({
    request,
  }) => {
    const index = await body(await request.get("/api/v1/projects"));
    const projects = (index.data as { projects: Array<{ slug: string }> })
      .projects;
    expect(projects.length).toBeGreaterThan(0);

    const slug = projects[0]!.slug;
    const detail = await request.get(`/api/v1/projects/${slug}`);
    expect(detail.status()).toBe(200);
    expect((await body(detail)).data).toMatchObject({ slug });

    // The page it mirrors exists too.
    expect((await request.get(`/projects/${slug}`)).status()).toBe(200);
  });

  test("an unpublished record is absent from the API, as it is from the site", async ({
    request,
  }) => {
    const missing = await request.get("/api/v1/projects/no-such-project-slug");
    expect(missing.status()).toBe(404);
    expect((await body(missing)).error?.code).toBe("not_found");
  });

  test("search needs two characters and returns public records only", async ({
    request,
  }) => {
    expect(
      (
        (await body(await request.get("/api/v1/search?q=a"))).data as {
          results: unknown[];
        }
      ).results,
    ).toEqual([]);

    const found = await body(await request.get("/api/v1/search?q=fixture"));
    expect(Array.isArray((found.data as { results: unknown[] }).results)).toBe(
      true,
    );
  });
});

test.describe("the API refuses what the website refuses", () => {
  test("a mutation without a client header is refused", async ({ request }) => {
    const response = await request.post("/api/v1/auth/sign-in", {
      data: { email: "fixture-member@sandhi.test", password: PASSWORD },
    });
    expect(response.status()).toBe(428);
    expect((await body(response)).error?.code).toBe("client_required");
  });

  test("a signed-out caller cannot read anything of a member's", async ({
    request,
  }) => {
    for (const path of [
      "/api/v1/me",
      "/api/v1/me/profile",
      "/api/v1/me/projects",
      "/api/v1/me/announcements",
      "/api/v1/me/documents",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
    }
  });

  test("a forged or expired bearer token is not a session", async ({
    request,
  }) => {
    for (const token of ["forged", "forged.signature", ""]) {
      const response = await request.get("/api/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status(), token).toBe(401);
    }
  });

  test("the wrong password is refused with the website's neutral message", async ({
    request,
  }) => {
    const response = await signIn(
      request,
      "fixture-member@sandhi.test",
      "not-the-password",
    );
    expect(response.status()).toBe(401);
    expect((await body(response)).error?.message).toBe(
      "The email address or password is incorrect.",
    );
  });

  test("a suspended member cannot start a session", async ({ request }) => {
    const response = await signIn(request, "fixture-suspended@sandhi.test");
    expect(response.status()).toBe(403);
  });
});

test.describe("signing in from a native client", () => {
  test("a member signs in, reads their own workspace, and signs out", async ({
    request,
  }) => {
    const email = "fixture-member@sandhi.test";
    // Every account needs an authenticator, so a native client is asked for a
    // code too — a member's password alone opens nothing here either.
    const asked = await body(await signIn(request, email));
    expect(asked.data).toMatchObject({ status: "two-factor" });
    expect(asked.data).not.toHaveProperty("token");

    const secret = twoFactorSecret(email);
    if (!secret) throw new Error(`No two-factor secret saved for ${email}.`);
    const challenge = (asked.data as { challenge: string }).challenge;

    let signedIn = await body(
      await request.post("/api/v1/auth/two-factor", {
        headers: { "x-sandhi-client": CLIENT },
        data: { challenge, code: totp(secret) },
      }),
    );
    // A code works once, so a neighbouring window covers a just-used one.
    if (!signedIn.data) {
      signedIn = await body(
        await request.post("/api/v1/auth/two-factor", {
          headers: { "x-sandhi-client": CLIENT },
          data: { challenge, code: totp(secret, 1) },
        }),
      );
    }
    expect(signedIn.data).toMatchObject({ status: "signed-in" });
    const token = (signedIn.data as { token: string }).token;
    const auth = { Authorization: `Bearer ${token}` };

    const me = await body(await request.get("/api/v1/me", { headers: auth }));
    expect(me.data).toMatchObject({
      email: "fixture-member@sandhi.test",
      role: "MEMBER",
      capabilities: ["portal:access"],
    });
    // A member's own answers are never cached.
    expect(
      (await request.get("/api/v1/me", { headers: auth })).headers()[
        "cache-control"
      ],
    ).toBe("private, no-store");

    for (const path of [
      "/api/v1/me/projects",
      "/api/v1/me/announcements",
      "/api/v1/me/documents",
    ]) {
      expect((await request.get(path, { headers: auth })).status(), path).toBe(
        200,
      );
    }

    const signedOut = await request.post("/api/v1/auth/sign-out", {
      headers: { ...auth, "x-sandhi-client": CLIENT },
    });
    expect(signedOut.status()).toBe(200);

    // The token stops working the moment the session ends.
    expect((await request.get("/api/v1/me", { headers: auth })).status()).toBe(
      401,
    );
  });

  /**
   * Better Auth stamps the discarded password-only session's token onto this
   * response. Answering "signed-in" here would hand the app a dead token and
   * skip the second factor entirely.
   */
  test("a staff account is asked for a code, not handed a session", async ({
    request,
  }) => {
    const response = await body(
      await signIn(request, "fixture-reviewer@sandhi.test"),
    );
    expect(response.data).toMatchObject({ status: "two-factor" });
    expect(response.data).not.toHaveProperty("token");

    const challenge = (response.data as { challenge: string }).challenge;
    expect(challenge).not.toContain("two_factor");

    // A wrong code is refused, and so is a challenge naming another cookie.
    const wrong = await request.post("/api/v1/auth/two-factor", {
      headers: { "x-sandhi-client": CLIENT },
      data: { challenge, code: "000000" },
    });
    expect(wrong.status()).toBe(401);

    const forged = await request.post("/api/v1/auth/two-factor", {
      headers: { "x-sandhi-client": CLIENT },
      data: {
        challenge: Buffer.from("better-auth.session_token=stolen").toString(
          "base64url",
        ),
        code: "000000",
      },
    });
    expect(forged.status()).toBe(400);
  });

  test("a password reset answers the same whether or not the account exists", async ({
    request,
  }) => {
    const answers = await Promise.all(
      ["fixture-member@sandhi.test", "nobody@sandhi.test"].map(
        async (email) => {
          const response = await request.post("/api/v1/auth/password-reset", {
            headers: { "x-sandhi-client": CLIENT },
            data: { email },
          });
          return { status: response.status(), body: await response.json() };
        },
      ),
    );
    expect(answers[0]).toEqual(answers[1]);
  });
});

test.describe("app distribution", () => {
  test("nothing is offered while no build is published", async ({
    request,
  }) => {
    const release = await body(await request.get("/api/v1/app/release"));
    expect(release.data).toMatchObject({ published: false });

    expect((await request.get("/app")).status()).toBe(404);
    expect(
      (await request.get("/download/android", { maxRedirects: 0 })).status(),
    ).toBe(404);
  });

  test("the Android link file is valid JSON whether or not an app exists", async ({
    request,
  }) => {
    const response = await request.get("/.well-known/assetlinks.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(Array.isArray(await response.json())).toBe(true);
  });

  test("the iOS link file is absent until an app id is configured", async ({
    request,
  }) => {
    const response = await request.get(
      "/.well-known/apple-app-site-association",
    );
    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      expect(await response.json()).toHaveProperty("applinks");
    }
  });
});
