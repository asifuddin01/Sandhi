import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { completeTwoFactor, PASSWORD, signIn } from "./support/auth";
import { totp } from "./support/totp";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

type TemporaryAccount = {
  email: string;
  name: string;
  cleanup: () => Promise<void>;
};

/** A fresh account created the real way, by accepting an invitation. */
async function invitedAccount(
  page: Page,
  role: "ADMIN" | "MEMBER",
): Promise<TemporaryAccount> {
  const db = createPrismaClient();
  const token = randomBytes(32).toString("base64url");
  const email = `two-factor-${role.toLowerCase()}-${Date.now()}@sandhi.test`;
  const name = `Temporary ${role === "ADMIN" ? "Administrator" : "Member"}`;
  const inviter = await db.user.findUniqueOrThrow({
    where: { email: "fixture-owner@sandhi.test" },
  });
  await db.invitation.create({
    data: {
      email,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      role,
      rank: "RESEARCHER",
      invitedById: inviter.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await page.goto(`/portal/accept-invite/${token}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/portal$/u, { timeout: 30_000 });

  return {
    email,
    name,
    cleanup: async () => {
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        const member = await db.member.findUnique({
          where: { userId: user.id },
        });
        await db.auditLog.deleteMany({
          where: {
            OR: [
              { actorId: user.id },
              { entityId: user.id },
              ...(member ? [{ entityId: member.id }] : []),
            ],
          },
        });
        await db.member.deleteMany({ where: { userId: user.id } });
        await db.user.delete({ where: { id: user.id } });
      }
      await db.invitation.deleteMany({ where: { email } });
      await db.$disconnect();
    },
  };
}

/** Sets up two-factor on the security page; returns the key and backup codes. */
async function setUpTwoFactor(page: Page) {
  await page.goto("/portal/security");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your password").fill(PASSWORD);
  await page
    .getByRole("button", { name: "Set up two-factor authentication" })
    .click();
  await expect(
    page.getByRole("img", { name: "QR code for your authenticator app" }),
  ).toBeVisible();
  const key = (await page.locator("code").first().textContent())!.replace(
    /\s/gu,
    "",
  );
  const backupCodes = await page
    .getByRole("list", { name: "Backup codes" })
    .locator("code")
    .allTextContents();
  expect(backupCodes).toHaveLength(10);

  await page.getByLabel("Code from the app").fill("000000");
  await page
    .getByRole("button", { name: "Turn on two-factor authentication" })
    .click();
  await expect(page.getByText(/That code is not correct/u)).toBeVisible();

  await page.getByLabel("Code from the app").fill(totp(key));
  await page
    .getByRole("button", { name: "Turn on two-factor authentication" })
    .click();
  await expect(page.getByText("On", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  return { key, backupCodes };
}

async function signOut(page: Page) {
  await page.goto("/portal");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/portal\/sign-in|\/$/u);
}

/** Submits the password step and waits for the code step. */
async function passwordStep(page: Page, email: string, next = "/admin") {
  await page.goto(`/portal/sign-in?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal\/two-factor/u, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

test("administration needs two-factor authentication, and codes work once", async ({
  page,
  browser,
  baseURL,
}) => {
  test.slow();
  const account = await invitedAccount(page, "ADMIN");
  const db = createPrismaClient();

  try {
    // Without two-factor, administration sends them to set it up...
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/portal\/security\?setup=two-factor$/u);
    await expect(
      page.getByText(/Your role needs two-factor authentication/u),
    ).toBeVisible();

    // ...and posting a genuine admin action directly changes nothing.
    const admin = await browser.newPage();
    await signIn(admin, "fixture-admin@sandhi.test", "/admin/members");
    const html = await (await admin.request.get("/admin/members")).text();
    const form = html
      .split("<form")
      .find((segment) => segment.includes('name="email"'));
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
    const blockedEmail = `blocked-${Date.now()}@sandhi.test`;
    await page.request.post("/admin/members", {
      headers: { Origin: new URL(baseURL!).origin },
      multipart: {
        ...fields,
        email: blockedEmail,
        role: "MEMBER",
        rank: "RESEARCHER",
      },
    });
    expect(await db.invitation.count({ where: { email: blockedEmail } })).toBe(
      0,
    );

    const { key, backupCodes } = await setUpTwoFactor(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/u);

    // Signing in now needs a code; a wrong one is refused.
    await signOut(page);
    await passwordStep(page, account.email);
    await page.getByLabel("Authentication code").fill("000000");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("That code is not correct.")).toBeVisible();
    // Setting up used this window's code, and codes work once; the next
    // window's code is already valid.
    const code = totp(key, 1);
    await page.getByLabel("Authentication code").fill(code);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/admin$/u, { timeout: 30_000 });

    // The same code cannot sign in twice.
    await signOut(page);
    await passwordStep(page, account.email);
    await page.getByLabel("Authentication code").fill(code);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/already used/u)).toBeVisible();
    await completeTwoFactor(page, key);
    await expect(page).toHaveURL(/\/admin$/u);

    // A backup code works exactly once.
    await signOut(page);
    await passwordStep(page, account.email);
    await page
      .getByRole("button", { name: "Use a backup code instead" })
      .click();
    await page.getByLabel("Backup code").fill(backupCodes[0]!);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/admin$/u, { timeout: 30_000 });
    const user = await db.user.findUniqueOrThrow({
      where: { email: account.email },
    });
    expect(
      await db.auditLog.count({
        where: { entityId: user.id, action: "auth.backup_code_used" },
      }),
    ).toBe(1);

    await signOut(page);
    await passwordStep(page, account.email);
    await page
      .getByRole("button", { name: "Use a backup code instead" })
      .click();
    await page.getByLabel("Backup code").fill(backupCodes[0]!);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(/not correct or was already used/u),
    ).toBeVisible();

    // Lost phone and codes: another administrator resets it.
    const member = await db.member.findUniqueOrThrow({
      where: { userId: user.id },
    });
    await admin.goto(`/admin/members/${member.id}`);
    await admin.waitForLoadState("networkidle");
    await admin
      .getByRole("button", {
        name: `Reset two-factor authentication for ${account.name}`,
      })
      .click();
    const dialog = admin.getByRole("dialog");
    await dialog
      .getByLabel(new RegExp(`Type ${account.name} to confirm`, "u"))
      .fill(account.name);
    await dialog.getByLabel("Your password").fill(PASSWORD);
    await dialog
      .getByRole("button", { name: "Reset two-factor authentication" })
      .click();
    await expect(
      admin.getByText(
        /^Off\. Their role requires it, so they set it up before administration opens\.$/u,
      ),
    ).toBeVisible();

    const reset = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        twoFactorEnabled: true,
        _count: { select: { sessions: true } },
      },
    });
    expect(reset.twoFactorEnabled).toBe(false);
    expect(reset._count.sessions).toBe(0);
    expect(await db.twoFactor.count({ where: { userId: user.id } })).toBe(0);
    await admin.context().close();
  } finally {
    await db.$disconnect();
    await account.cleanup();
  }
});

test("two-factor cannot be turned off over HTTP, or at all by staff", async ({
  page,
  request,
}) => {
  for (const endpoint of [
    "/api/auth/two-factor/disable",
    "/api/auth/two-factor/get-totp-uri",
    "/api/auth/two-factor/send-otp",
  ]) {
    const response = await request.post(endpoint, {
      data: { password: PASSWORD },
    });
    expect(response.status(), endpoint).toBe(404);
  }

  await signIn(page, "fixture-reviewer@sandhi.test", "/portal/security");
  await expect(
    page.getByText(/Your role requires two-factor authentication/u),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Turn off two-factor authentication" }),
  ).toHaveCount(0);
});

test("members may turn two-factor authentication on and off", async ({
  page,
}) => {
  test.slow();
  const account = await invitedAccount(page, "MEMBER");
  try {
    await setUpTwoFactor(page);
    await page.getByLabel("Your password").last().fill(PASSWORD);
    await page
      .getByRole("button", { name: "Turn off two-factor authentication" })
      .click();
    await expect(
      page.getByRole("button", { name: "Set up two-factor authentication" }),
    ).toBeVisible({ timeout: 30_000 });

    // Signing in again needs only the password.
    await signOut(page);
    await signIn(page, account.email, "/portal");
  } finally {
    await account.cleanup();
  }
});
