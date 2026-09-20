import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import {
  ENROLLED_EMAILS,
  PASSWORD,
  sessionStateFile,
  TWO_FACTOR_FILE,
} from "./support/auth";
import { totp } from "./support/totp";

setup.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/**
 * Two-factor authentication is required of every account, so each fixture
 * account that signs in is enrolled afresh through the real setup screen,
 * and its secret and session saved for the tests' sign-in helper.
 */
setup(
  "enroll fixture accounts in two-factor authentication",
  async ({ browser }) => {
    // Six accounts, each enrolled through the real screen: this is the
    // slowest thing in the suite and `slow()` alone no longer covers it.
    setup.setTimeout(420_000);
    const db = createPrismaClient();
    const secrets: Record<string, string> = {};

    try {
      for (const email of ENROLLED_EMAILS) {
        const user = await db.user.findUniqueOrThrow({ where: { email } });
        await db.$transaction([
          db.twoFactor.deleteMany({ where: { userId: user.id } }),
          db.user.update({
            where: { id: user.id },
            data: { twoFactorEnabled: false },
          }),
          db.session.deleteMany({ where: { userId: user.id } }),
        ]);

        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto("/portal/sign-in?next=%2Fportal%2Fsecurity");
        await page.waitForLoadState("networkidle");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(PASSWORD);
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        // Without an authenticator the portal sends them here itself, with
        // `?setup=two-factor` on the end, so the query is not asserted away.
        await expect(page).toHaveURL(/\/portal\/security(\?|$)/u, {
          timeout: 30_000,
        });
        await page.waitForLoadState("networkidle");

        await page
          .getByRole("region", { name: "Two-factor authentication" })
          .getByLabel("Your password")
          .fill(PASSWORD);
        await page
          .getByRole("button", { name: "Set up two-factor authentication" })
          .click();
        const key = (await page.locator("code").first().textContent())!.replace(
          /\s/gu,
          "",
        );
        expect(key).toMatch(/^[A-Z2-7]{16,}$/u);

        // A code is good for thirty seconds, and enrolling six accounts is
        // slow enough that the window can roll over between filling the box
        // and the server reading it. Try the neighbouring windows too.
        const badge = page.getByText("On", { exact: true });
        let turnedOn = false;
        for (const offset of [0, 1, -1]) {
          await page.getByLabel("Code from the app").fill(totp(key, offset));
          await page
            .getByRole("button", { name: "Turn on two-factor authentication" })
            .click();
          try {
            await expect(badge).toBeVisible({ timeout: 15_000 });
            turnedOn = true;
            break;
          } catch {
            // Wrong window: the form is still there, so fill it again.
          }
        }
        if (!turnedOn) {
          throw new Error(`Could not enroll ${email} in two-factor.`);
        }

        secrets[email] = key;
        // Setting it up leaves a fully signed-in session; tests reuse it.
        mkdirSync(path.dirname(TWO_FACTOR_FILE), { recursive: true });
        await context.storageState({ path: sessionStateFile(email) });
        await context.close();
      }
    } finally {
      await db.$disconnect();
    }

    mkdirSync(path.dirname(TWO_FACTOR_FILE), { recursive: true });
    writeFileSync(TWO_FACTOR_FILE, JSON.stringify(secrets, null, 2));
  },
);
