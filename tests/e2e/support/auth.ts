import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { totp } from "./totp";

export const PASSWORD = "fixture-password-2026";

/** Accounts whose role requires two-factor authentication. */
export const STAFF_EMAILS = [
  "fixture-owner@sandhi.test",
  "fixture-admin@sandhi.test",
  "fixture-reviewer@sandhi.test",
] as const;

/** Written by the setup project, which enrolls each staff account. */
export const TWO_FACTOR_FILE = path.join(
  process.cwd(),
  ".playwright",
  "two-factor.json",
);

/** A staff account's signed-in session, saved by the setup project. */
export function sessionStateFile(email: string): string {
  return path.join(path.dirname(TWO_FACTOR_FILE), `${email}.json`);
}

export function twoFactorSecret(email: string): string | null {
  try {
    const secrets = JSON.parse(readFileSync(TWO_FACTOR_FILE, "utf8")) as Record<
      string,
      string
    >;
    return secrets[email] ?? null;
  } catch {
    return null;
  }
}

/**
 * Finishes the second sign-in step. Codes work once, so when another test
 * has just used this window's code, try the neighbouring windows, then wait
 * for a fresh one. Each attempt is judged by its own server response, never
 * by a message still showing from the one before.
 */
export async function completeTwoFactor(page: Page, secret: string) {
  for (let round = 0; round < 3; round += 1) {
    for (const offset of [0, 1, -1]) {
      await page.getByLabel("Authentication code").fill(totp(secret, offset));
      const [response] = await Promise.all([
        page.waitForResponse(
          (candidate) =>
            candidate.request().method() === "POST" &&
            new URL(candidate.url()).pathname === "/portal/two-factor",
          { timeout: 30_000 },
        ),
        page.getByRole("button", { name: "Continue" }).click(),
      ]);
      // A successful server action answers with where to go next.
      if (response.headers()["x-action-redirect"]) {
        await page.waitForURL(
          (url) => !url.pathname.startsWith("/portal/two-factor"),
          { timeout: 30_000 },
        );
        return;
      }
      await expect(
        page.getByRole("button", { name: "Continue" }),
      ).toBeEnabled();
      const message =
        (await page.getByRole("alert").first().textContent()) ?? "";
      if (!/already used|not correct/u.test(message)) {
        throw new Error(`Two-factor sign-in failed: ${message}`);
      }
    }
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
  }
  throw new Error("No fresh two-factor code was accepted.");
}

/** Signs in through the form, completing two-factor for staff accounts. */
export async function signInThroughForm(
  page: Page,
  email: string,
  next = "/portal",
  password = PASSWORD,
) {
  await page.goto(`/portal/sign-in?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/portal/sign-in"), {
    timeout: 30_000,
  });
  if (new URL(page.url()).pathname === "/portal/two-factor") {
    const secret = twoFactorSecret(email);
    if (!secret) throw new Error(`No two-factor secret for ${email}.`);
    await page.waitForLoadState("networkidle");
    await completeTwoFactor(page, secret);
  }
  // The first visit to a route compiles it in development.
  await expect(page).toHaveURL(
    new RegExp(`${next.replace(/[?]/gu, "\\?")}$`, "u"),
    { timeout: 30_000 },
  );
}

/**
 * Signs in for a test that is not about signing in. Staff accounts reuse the
 * session saved when they were enrolled, since each authenticator code works
 * only once and many tests sign in as the same administrator.
 */
export async function signIn(
  page: Page,
  email: string,
  next = "/portal",
  password = PASSWORD,
) {
  const staff = (STAFF_EMAILS as readonly string[]).includes(email);
  if (!staff || password !== PASSWORD) {
    await signInThroughForm(page, email, next, password);
    return;
  }
  const state = JSON.parse(readFileSync(sessionStateFile(email), "utf8")) as {
    cookies: Parameters<ReturnType<Page["context"]>["addCookies"]>[0];
  };
  await page.context().addCookies(state.cookies);
  await page.goto(next);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(
    new RegExp(`${next.replace(/[?]/gu, "\\?")}$`, "u"),
    { timeout: 30_000 },
  );
}
