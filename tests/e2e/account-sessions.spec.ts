import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

import { createPrismaClient } from "../../lib/db-runtime";

import { completeTwoFactor, twoFactorSecret } from "./support/auth";

const PASSWORD = "fixture-password-2026";
const FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

// These tests share an account's sessions, and each signs in several
// browsers with deliberately slow password hashing.
test.describe.configure({ mode: "serial" });
test.slow();

/** Puts the shared fixture password back, whatever a test changed it to. */
async function resetPassword(email: string) {
  const db = createPrismaClient();
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: await hashPassword(PASSWORD) },
    });
  } finally {
    await db.$disconnect();
  }
}

async function signedIn(
  browser: Browser,
  email: string,
  userAgent?: string,
  password = PASSWORD,
): Promise<Page> {
  const context = await browser.newContext(userAgent ? { userAgent } : {});
  const page = await context.newPage();
  await page.goto("/portal/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Every account holds an authenticator now, so the form is only step one.
  const secret = twoFactorSecret(email);
  if (!secret) throw new Error(`No two-factor secret saved for ${email}.`);
  await page.waitForURL(/\/portal\/two-factor/u, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await completeTwoFactor(page, secret);
  await expect(page).toHaveURL(/\/portal$/u, { timeout: 30_000 });
  return page;
}

async function stillSignedIn(page: Page): Promise<boolean> {
  await page.goto("/portal");
  return !page.url().includes("/portal/sign-in");
}

async function forget(email: string) {
  const db = createPrismaClient();
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.auditLog.deleteMany({
      where: { entityId: user.id, action: { startsWith: "auth." } },
    });
  } finally {
    await db.$disconnect();
  }
}

test("people see where they are signed in and can sign other sessions out", async ({
  browser,
}) => {
  const email = "fixture-sessions@sandhi.test";
  await forget(email);
  const here = await signedIn(browser, email);
  const laptop = await signedIn(browser, email, FIREFOX);
  const phone = await signedIn(browser, email);

  try {
    await here.goto("/portal/security");
    await here.waitForLoadState("networkidle");
    const sessions = here.getByRole("list").filter({ hasText: "This device" });
    await expect(sessions.getByRole("listitem")).toHaveCount(3);
    await expect(sessions.getByText("This device")).toHaveCount(1);
    await expect(
      here.getByRole("heading", { name: "Recent activity" }),
    ).toBeVisible();
    await expect(here.getByText("Signed in").first()).toBeVisible();

    const { violations } = await new AxeBuilder({ page: here })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map(({ id, nodes }) => ({ id, nodes: nodes.length })),
    ).toEqual([]);

    // End one session by name.
    await here
      .getByRole("button", { name: /^Sign out Firefox on Linux, signed in/u })
      .click();
    await expect(here.getByText("Signed out of that session.")).toBeVisible();
    expect(await stillSignedIn(laptop)).toBe(false);
    expect(await stillSignedIn(phone)).toBe(true);

    // Then every other one, keeping this one.
    await here.goto("/portal/security");
    await here.waitForLoadState("networkidle");
    await here
      .getByRole("button", { name: "Sign out of all other sessions" })
      .click();
    await expect(
      here.getByText("Signed out of 1 other session."),
    ).toBeVisible();
    expect(await stillSignedIn(phone)).toBe(false);
    expect(await stillSignedIn(here)).toBe(true);
  } finally {
    await Promise.all(
      [here, laptop, phone].map((page) => page.context().close()),
    );
    await forget(email);
  }
});

test("nobody can sign out someone else's session", async ({
  browser,
  baseURL,
}) => {
  const victim = "fixture-sessions@sandhi.test";
  const attacker = "fixture-member@sandhi.test";
  const victimPage = await signedIn(browser, victim);
  const attackerPage = await signedIn(browser, attacker);
  const db = createPrismaClient();

  try {
    const target = await db.session.findFirstOrThrow({
      where: { user: { email: victim } },
      orderBy: { createdAt: "desc" },
    });

    // Genuine action references from the attacker's own security page.
    const html = await (
      await attackerPage.request.get("/portal/security")
    ).text();
    const form = html
      .split("<form")
      .find((segment) => segment.includes('name="operation"'));
    const fields = Object.fromEntries(
      Array.from(
        (form ?? "").matchAll(
          /<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gu,
        ),
        (match) => [
          match[1]!,
          (match[2] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
        ],
      ),
    );
    expect(Object.keys(fields).length).toBeGreaterThan(0);

    await attackerPage.request.post("/portal/security", {
      headers: { Origin: new URL(baseURL!).origin },
      multipart: { ...fields, operation: `revoke:${target.id}` },
    });

    expect(await db.session.count({ where: { id: target.id } })).toBe(1);
    expect(await stillSignedIn(victimPage)).toBe(true);
  } finally {
    await db.$disconnect();
    await victimPage.context().close();
    await attackerPage.context().close();
    await forget(victim);
  }
});

test("changing the password needs the current one and signs out other sessions", async ({
  browser,
}) => {
  const email = "fixture-password@sandhi.test";
  const newPassword = "fixture-password-2026-changed";
  await forget(email);
  await resetPassword(email);
  const here = await signedIn(browser, email);
  const elsewhere = await signedIn(browser, email, FIREFOX);

  const change = async (current: string, next: string) => {
    await here.getByLabel("Current password").fill(current);
    await here.getByLabel("New password", { exact: true }).fill(next);
    await here.getByLabel("Confirm new password").fill(next);
    await here.getByRole("button", { name: "Change password" }).click();
  };

  try {
    await here.goto("/portal/security");
    await here.waitForLoadState("networkidle");

    await change("not-the-password-at-all", newPassword);
    await expect(
      here.getByText("Your current password is not correct."),
    ).toBeVisible();
    expect(await stillSignedIn(elsewhere)).toBe(true);

    await here.goto("/portal/security");
    await here.waitForLoadState("networkidle");
    await change(PASSWORD, newPassword);
    await expect(
      here.getByText("Password changed. Every other session was signed out."),
    ).toBeVisible();
    await expect(here.getByLabel("Current password")).toHaveValue("");
    expect(await stillSignedIn(elsewhere)).toBe(false);
    expect(await stillSignedIn(here)).toBe(true);

    // The new password is the one that now signs in.
    const fresh = await signedIn(browser, email, undefined, newPassword);
    await fresh.context().close();

    const db = createPrismaClient();
    try {
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      const actions = (
        await db.auditLog.findMany({
          where: { entityId: user.id, action: { startsWith: "auth." } },
          select: { action: true },
        })
      ).map(({ action }) => action);
      expect(actions).toContain("auth.reauth_failed");
      expect(actions).toContain("auth.password_changed");
    } finally {
      await db.$disconnect();
    }
  } finally {
    await here.context().close();
    await elsewhere.context().close();
    await resetPassword(email);
    await forget(email);
  }
});
