import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

const PASSWORD = "fixture-password-2026";

async function signIn(page: Page, email: string, next?: string) {
  await page.goto(
    next
      ? `/portal/sign-in?next=${encodeURIComponent(next)}`
      : "/portal/sign-in",
  );
  // In development, a route compiling for the first time can reload the page
  // mid-typing; wait until it has settled.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("sign-in and administration access", () => {
  test.skip(
    process.env.E2E_FIXTURES_READY !== "true",
    "Run migrations, seed, and seed:fixtures against an isolated test database, then set E2E_FIXTURES_READY=true.",
  );

  test("signed-out visitors are sent to sign in and returned afterwards", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/portal\/sign-in\?next=%2Fadmin$/u);

    await page.getByLabel("Email").fill("fixture-admin@sandhi.test");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin$/u);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Dashboard",
    );
    await expect(page.getByText("Active members")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent activity" }),
    ).toBeVisible();
  });

  test("a wrong password is refused without revealing which part was wrong", async ({
    page,
  }) => {
    await page.goto("/portal/sign-in");
    await page.getByLabel("Email").fill("fixture-member@sandhi.test");
    await page.getByLabel("Password").fill("not-the-password-at-all");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText("The email address or password is incorrect."),
    ).toBeVisible();
    // The address stays filled in so only the password needs retyping.
    await expect(page.getByLabel("Email")).toHaveValue(
      "fixture-member@sandhi.test",
    );
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/sign-in/u);
  });

  test("a member reaches the portal but never administration", async ({
    page,
  }) => {
    await signIn(page, "fixture-member@sandhi.test");
    await expect(page).toHaveURL(/\/portal$/u);
    await expect(
      page.getByRole("heading", { name: "Welcome, Fixture Member" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open administration" }),
    ).toHaveCount(0);

    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Active members")).toHaveCount(0);
  });

  test("a reviewer reaches administration without the audit log", async ({
    page,
  }) => {
    await signIn(page, "fixture-reviewer@sandhi.test", "/admin");
    await expect(page).toHaveURL(/\/admin$/u);
    await expect(page.getByText("Active members")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent activity" }),
    ).toHaveCount(0);
  });

  test("suspended and unverified accounts cannot start a session", async ({
    page,
  }) => {
    await signIn(page, "fixture-suspended@sandhi.test");
    await expect(page.getByText(/Sign-in did not complete/u)).toBeVisible();

    await signIn(page, "fixture-unverified@sandhi.test");
    await expect(
      page.getByText(
        "Confirm your email address first. We have sent you a new link.",
      ),
    ).toBeVisible();

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/sign-in/u);
  });

  test("a crafted next parameter cannot redirect off the site", async ({
    page,
  }) => {
    await signIn(page, "fixture-member@sandhi.test", "https://evil.example/");
    await expect(page).toHaveURL(
      /127\.0\.0\.1:\d+\/portal$|localhost:\d+\/portal$/u,
    );
  });

  test("signing out ends the session", async ({ page }) => {
    await signIn(page, "fixture-member@sandhi.test");
    await expect(page).toHaveURL(/\/portal$/u);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/portal\/sign-in$/u);

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/sign-in/u);
  });

  test("a reset request gives the same answer for any address", async ({
    page,
  }) => {
    for (const email of [
      "fixture-member@sandhi.test",
      "nobody-here@sandhi.test",
    ]) {
      await page.goto("/portal/reset-password");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(
        page.getByText(
          "If an account uses that address, we have sent a link to reset its password.",
        ),
      ).toBeVisible();
    }
  });
});

test.describe("only real, verified accounts can sign in", () => {
  test.skip(
    process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
    "Needs the fixture database and DATABASE_URL to check stored accounts.",
  );

  test("nobody can create an account without an invitation", async ({
    request,
    baseURL,
  }) => {
    const email = `self-signup-${Date.now()}@sandhi.test`;
    const response = await request.post("/api/auth/sign-up/email", {
      headers: { Origin: new URL(baseURL!).origin },
      data: { email, password: PASSWORD, name: "Self Signup" },
    });
    expect(response.status()).toBe(404);

    const db = createPrismaClient();
    try {
      expect(await db.user.count({ where: { email } })).toBe(0);
    } finally {
      await db.$disconnect();
    }
  });

  test("an unknown address cannot sign in", async ({ page, request }) => {
    await signIn(page, `nobody-${Date.now()}@sandhi.test`);
    await expect(
      page.getByText("The email address or password is incorrect."),
    ).toBeVisible();

    // Directly against the API as well, not only through the form.
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email: `nobody-${Date.now()}@sandhi.test`, password: PASSWORD },
    });
    expect(response.status()).toBe(401);
    expect(response.headers()["set-cookie"] ?? "").not.toMatch(
      /session_token=[^;]+/u,
    );
  });

  test("an unverified address gets no session, even through the API", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email: "fixture-unverified@sandhi.test", password: PASSWORD },
    });
    expect(response.status()).toBe(403);
    expect(((await response.json()) as { code?: string }).code).toBe(
      "EMAIL_NOT_VERIFIED",
    );
    expect(response.headers()["set-cookie"] ?? "").not.toMatch(
      /session_token=[^;]+/u,
    );

    const session = await request.get("/api/auth/get-session");
    expect(await session.json()).toBeNull();
  });

  test("a forged session cookie grants nothing", async ({
    context,
    page,
    baseURL,
  }) => {
    const { hostname } = new URL(baseURL!);
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "forged-token.forged-signature",
        domain: hostname,
        path: "/",
      },
    ]);

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/sign-in/u);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/portal\/sign-in/u);
    await expect(page.getByText("Active members")).toHaveCount(0);
  });
});

test.describe("password reset", () => {
  test.skip(
    process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
    "Needs the fixture database and DATABASE_URL to read the reset token.",
  );

  test("the emailed link leads to a new password that signs in", async ({
    page,
  }) => {
    const db = createPrismaClient();
    try {
      const user = await db.user.findUniqueOrThrow({
        where: { email: "fixture-reviewer@sandhi.test" },
      });
      await db.verification.deleteMany({ where: { value: user.id } });

      await page.goto("/portal/reset-password");
      await page.getByLabel("Email").fill(user.email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.getByText(/we have sent a link/u)).toBeVisible();

      // The emailed token is stored only as a hash: the database never
      // holds a working link.
      const stored = await db.verification.findFirstOrThrow({
        where: { value: user.id },
        orderBy: { createdAt: "desc" },
      });
      expect(stored.identifier).not.toContain("reset-password:");
      expect(stored.identifier).toMatch(/^[A-Za-z0-9_-]{43}$/u);

      // So issue a link the same way Better Auth does, since the test cannot
      // read the email.
      const token = randomBytes(18).toString("base64url");
      await db.verification.create({
        data: {
          id: `e2e-reset-${Date.now()}`,
          identifier: createHash("sha256")
            .update(`reset-password:${token}`)
            .digest("base64url"),
          value: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // The same link the email contains.
      await page.goto(
        `/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent("/portal/reset-password")}`,
      );
      await expect(page).toHaveURL(/\/portal\/reset-password\?token=/u);
      await expect(
        page.getByRole("heading", { name: "Choose a new password" }),
      ).toBeVisible();

      // Reset to the shared fixture password so other tests keep working.
      await page.getByLabel("New password").fill(PASSWORD);
      await page.getByLabel("Confirm password").fill(PASSWORD);
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(
        page.getByText(
          "Your password has been changed. You can sign in with it now.",
        ),
      ).toBeVisible();

      await signIn(page, user.email, "/admin");
      await expect(page).toHaveURL(/\/admin$/u);

      // A used link cannot be replayed.
      await page.goto(`/portal/reset-password?token=${token}`);
      await page.getByLabel("New password").fill(PASSWORD);
      await page.getByLabel("Confirm password").fill(PASSWORD);
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(
        page.getByText(/expired or was already used/u),
      ).toBeVisible();
    } finally {
      await db.$disconnect();
    }
  });
});

test.describe("invitations", () => {
  test.skip(
    process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
    "Needs the fixture database and DATABASE_URL to create an invitation.",
  );

  test("an invitation creates one account, signs it in, and cannot be reused", async ({
    page,
  }) => {
    const db = createPrismaClient();
    const token = randomBytes(32).toString("base64url");
    const email = `invitee-${Date.now()}@sandhi.test`;

    try {
      const inviter = await db.user.findUniqueOrThrow({
        where: { email: "fixture-admin@sandhi.test" },
      });
      await db.invitation.create({
        data: {
          email,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          role: "MEMBER",
          rank: "RESEARCHER",
          invitedById: inviter.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await page.goto(`/portal/accept-invite/${token}`);
      await expect(page.getByText(email)).toBeVisible();
      await page.getByLabel("Full name").fill("Invited Researcher");
      await page.getByLabel("New password").fill(PASSWORD);
      await page.getByLabel("Confirm password").fill(PASSWORD);
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page).toHaveURL(/\/portal$/u);
      await expect(
        page.getByRole("heading", { name: "Welcome, Invited Researcher" }),
      ).toBeVisible();

      const member = await db.member.findFirstOrThrow({
        where: { user: { email } },
      });
      expect(member.status).toBe("ACTIVE");
      expect(member.isPublic).toBe(false);

      await page.goto(`/portal/accept-invite/${token}`);
      await expect(
        page.getByRole("heading", { name: "Invitation unavailable" }),
      ).toBeVisible();
    } finally {
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        await db.auditLog.deleteMany({ where: { actorId: user.id } });
        await db.invitation.deleteMany({ where: { email } });
        await db.member.deleteMany({ where: { userId: user.id } });
        await db.user.delete({ where: { id: user.id } });
      } else {
        await db.invitation.deleteMany({ where: { email } });
      }
      await db.$disconnect();
    }
  });
});
