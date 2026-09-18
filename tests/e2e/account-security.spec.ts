import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Browser } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

const PASSWORD = "fixture-password-2026";
// Appears tens of thousands of times in the Have I Been Pwned corpus.
const BREACHED_PASSWORD = "password123456";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

async function userId(email: string): Promise<string> {
  const db = createPrismaClient();
  try {
    return (await db.user.findUniqueOrThrow({ where: { email } })).id;
  } finally {
    await db.$disconnect();
  }
}

async function securityEvents(id: string, since: Date) {
  const db = createPrismaClient();
  try {
    return await db.auditLog.findMany({
      where: {
        entityId: id,
        action: { startsWith: "auth." },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      select: { action: true, diff: true },
    });
  } finally {
    await db.$disconnect();
  }
}

async function forgetEvents(id: string, since: Date) {
  const db = createPrismaClient();
  try {
    await db.auditLog.deleteMany({
      where: {
        entityId: id,
        action: { startsWith: "auth." },
        createdAt: { gte: since },
      },
    });
  } finally {
    await db.$disconnect();
  }
}

async function signInWith(browser: Browser, email: string, userAgent?: string) {
  const context = await browser.newContext(userAgent ? { userAgent } : {});
  const page = await context.newPage();
  await page.goto("/portal/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal$/u, { timeout: 30_000 });
  await context.close();
}

/** Skips when the breach service cannot be reached from this machine. */
async function breachServiceReachable(): Promise<boolean> {
  try {
    const response = await fetch("https://api.pwnedpasswords.com/range/00000", {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

test("failed sign-ins are recorded, and repeated ones alert the account holder once", async ({
  page,
  request,
}) => {
  const email = "fixture-staff@sandhi.test";
  const id = await userId(email);
  const since = new Date();
  const attempt = async () => {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email, password: "not-the-password-at-all" },
    });
    expect(response.status(), await response.text()).toBe(401);
  };

  try {
    // Four through the API and one through the sign-in form.
    for (let count = 0; count < 4; count += 1) await attempt();
    await page.goto("/portal/sign-in");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-password-at-all");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("The email address or password is incorrect."),
    ).toBeVisible();

    const events = await securityEvents(id, since);
    const failures = events.filter(
      ({ action }) => action === "auth.sign_in_failed",
    );
    expect(failures).toHaveLength(5);
    expect(failures[0]?.diff).toMatchObject({ reason: "password" });
    expect(
      events.filter(
        ({ action, diff }) =>
          action === "auth.alert_sent" &&
          (diff as { kind?: string }).kind === "failed-attempts",
      ),
    ).toHaveLength(1);

    // A sixth failure within the hour sends no second alert.
    await attempt();
    const after = await securityEvents(id, since);
    expect(
      after.filter(({ action }) => action === "auth.alert_sent"),
    ).toHaveLength(1);
  } finally {
    await forgetEvents(id, since);
  }
});

test("sign-ins are recorded, and one from a new device alerts the account holder", async ({
  browser,
}) => {
  const email = "fixture-reviewer@sandhi.test";
  const id = await userId(email);
  const since = new Date();
  const firefox =
    "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

  try {
    // Establish this browser as known, then sign in from another one twice.
    await signInWith(browser, email);
    await signInWith(browser, email, firefox);
    await signInWith(browser, email, firefox);

    const events = await securityEvents(id, since);
    const signIns = events.filter(({ action }) => action === "auth.sign_in");
    expect(signIns.length).toBeGreaterThanOrEqual(3);
    expect(signIns.at(-1)?.diff).toMatchObject({ device: "Firefox on Linux" });

    const newDeviceAlerts = events.filter(
      ({ action, diff }) =>
        action === "auth.alert_sent" &&
        (diff as { kind?: string }).kind === "new-sign-in",
    );
    expect(newDeviceAlerts).toHaveLength(1);
    expect(newDeviceAlerts[0]?.diff).toMatchObject({
      device: "Firefox on Linux",
    });
  } finally {
    await forgetEvents(id, since);
  }
});

test("a password found in a data breach cannot be chosen", async ({ page }) => {
  test.skip(
    !(await breachServiceReachable()),
    "The breach service is not reachable from this machine.",
  );
  const db = createPrismaClient();
  const token = randomBytes(32).toString("base64url");
  const email = `breach-${Date.now()}@sandhi.test`;
  const since = new Date();

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
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Full name").fill("Breach Check");
    await page.getByLabel("New password").fill(BREACHED_PASSWORD);
    await page.getByLabel("Confirm password").fill(BREACHED_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText(/appeared in a known data breach/u),
    ).toBeVisible();
    expect(await db.user.count({ where: { email } })).toBe(0);

    // The invitation still works with a password that is not breached, and
    // what was typed is still there.
    await expect(page.getByLabel("Full name")).toHaveValue("Breach Check");
    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/portal$/u, { timeout: 30_000 });

    // The same check guards password resets.
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const resetToken = randomBytes(18).toString("base64url");
    await db.verification.create({
      data: {
        id: `e2e-breach-${Date.now()}`,
        identifier: createHash("sha256")
          .update(`reset-password:${resetToken}`)
          .digest("base64url"),
        value: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await page.goto(`/portal/reset-password?token=${resetToken}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("New password").fill(BREACHED_PASSWORD);
    await page.getByLabel("Confirm password").fill(BREACHED_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      page.getByText(/appeared in a known data breach/u),
    ).toBeVisible();

    // Refusing the password did not use up the link.
    await page.getByLabel("New password").fill(`${PASSWORD}-new`);
    await page.getByLabel("Confirm password").fill(`${PASSWORD}-new`);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      page.getByText(
        "Your password has been changed. You can sign in with it now.",
      ),
    ).toBeVisible();

    const changed = await db.auditLog.count({
      where: {
        entityId: user.id,
        action: "auth.password_changed",
        createdAt: { gte: since },
      },
    });
    expect(changed).toBe(1);
  } finally {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await db.auditLog.deleteMany({
        where: { OR: [{ actorId: user.id }, { entityId: user.id }] },
      });
      await db.verification.deleteMany({ where: { value: user.id } });
      await db.member.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
    await db.invitation.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
