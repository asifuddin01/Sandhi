import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import {
  PASSWORD,
  sessionStateFile,
  STAFF_EMAILS,
  TWO_FACTOR_FILE,
} from "./support/auth";
import { totp } from "./support/totp";

setup.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/**
 * Staff roles need two-factor authentication, so each staff fixture account
 * is enrolled afresh through the real setup screen, and its secret saved for
 * the tests' sign-in helper.
 */
setup(
  "enroll staff fixture accounts in two-factor authentication",
  async ({ browser }) => {
    setup.slow();
    const db = createPrismaClient();
    const secrets: Record<string, string> = {};

    try {
      for (const email of STAFF_EMAILS) {
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
        await expect(page).toHaveURL(/\/portal\/security$/u, {
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
        await page.getByLabel("Code from the app").fill(totp(key));
        await page
          .getByRole("button", { name: "Turn on two-factor authentication" })
          .click();
        await expect(page.getByText("On", { exact: true })).toBeVisible({
          timeout: 30_000,
        });

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
