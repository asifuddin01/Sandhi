import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { sessionStateFile, signIn } from "./support/auth";

/**
 * Two of these write to the same account, and each begins by wiping its
 * profile. Run in parallel, one blanks what the other has just saved and the
 * gate fires when it should not. They take turns.
 */
test.describe.configure({ mode: "serial" });

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

const BLANK = "fixture-blank@sandhi.test";
const BIO =
  "I work on segmentation of low-contrast structures in abdominal CT, and on what happens to those models when the scanner changes underneath them.";

/** Puts the account back to having never written a profile. */
async function blank() {
  const db = createPrismaClient();
  try {
    await db.member.update({
      where: {
        userId: (await db.user.findUniqueOrThrow({ where: { email: BLANK } }))
          .id,
      },
      data: {
        bio: null,
        interests: [],
        title: null,
        profileCompletedAt: null,
      },
    });
  } finally {
    await db.$disconnect();
  }
}

/**
 * Signs in without asserting where it lands, which is the whole point here:
 * this account is sent somewhere it did not ask to go.
 */
async function signInBlank(page: Page, to = "/portal") {
  const state = JSON.parse(readFileSync(sessionStateFile(BLANK), "utf8")) as {
    cookies: Parameters<ReturnType<Page["context"]>["addCookies"]>[0];
  };
  await page.context().addCookies(state.cookies);
  await page.goto(to);
  await page.waitForLoadState("networkidle");
}

test("the portal asks a new member for a profile, then lets go once it has one", async ({
  page,
}) => {
  test.slow();
  try {
    await blank();
    await signInBlank(page);

    // Asked for, wherever in the portal they were headed.
    await expect(page).toHaveURL(/\/portal\/profile\?setup=profile$/u, {
      timeout: 30_000,
    });
    await expect(
      page.getByText("One last thing before the portal opens"),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toContainText([
      "a short description of your work",
      "at least one research interest",
    ]);

    // Not a dead end: somebody who cannot finish this can still leave.
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // A deeper page is held too, not just the portal's front door.
    await page.goto("/portal/projects");
    await expect(page).toHaveURL(/\/portal\/profile\?setup=profile$/u, {
      timeout: 30_000,
    });

    await page.getByLabel("About your work").fill(BIO);
    await page.getByLabel("Research interests").fill("Medical imaging\nCT");
    await page.getByRole("button", { name: "Save my profile" }).click();
    await expect(page.getByText("Your profile is saved.")).toBeVisible({
      timeout: 30_000,
    });

    // The gate is open from here on.
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal$/u, { timeout: 30_000 });
    await page.goto("/portal/projects");
    await expect(page).toHaveURL(/\/portal\/projects$/u, { timeout: 30_000 });

    // And the answers were kept, not just counted.
    await page.goto("/portal/profile");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("About your work")).toHaveValue(BIO);
    await expect(page.getByLabel("Research interests")).toHaveValue(
      "Medical imaging\nCT",
    );
  } finally {
    await blank();
  }
});

test("emptying a profile makes the portal ask again", async ({ page }) => {
  test.slow();
  try {
    await blank();
    await signInBlank(page, "/portal/profile");

    await page.getByLabel("About your work").fill(BIO);
    await page.getByLabel("Research interests").fill("Medical imaging");
    await page.getByRole("button", { name: "Save my profile" }).click();
    await expect(page.getByText("Your profile is saved.")).toBeVisible({
      timeout: 30_000,
    });

    // The form itself will not send an empty answer.
    await page.getByLabel("Research interests").fill("");
    await page.getByRole("button", { name: "Save my profile" }).click();
    await expect(page.getByText("Your profile is saved.")).toBeVisible();

    // But `required` is a courtesy of the browser, not a rule of the system.
    // Turning it off is what any client that is not a browser amounts to, and
    // the server must still recompute rather than take the earlier answer on
    // trust.
    // The page has several forms (sign out, search), so this finds the one
    // the profile fields are in rather than the first on the page.
    const relaxed = await page.evaluate(() => {
      const form = document
        .querySelector('textarea[name="interests"]')
        ?.closest("form");
      if (!form) return 0;
      form.noValidate = true;
      const required = form.querySelectorAll("[required]");
      for (const control of required) control.removeAttribute("required");
      return required.length;
    });
    expect(relaxed).toBeGreaterThan(0);
    await page.getByLabel("Research interests").fill("");
    await page.getByRole("button", { name: "Save my profile" }).click();
    await expect(page.getByText(/will keep asking/u)).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/profile\?setup=profile$/u, {
      timeout: 30_000,
    });
  } finally {
    await blank();
  }
});

test("a member with a profile is never sent to write one", async ({ page }) => {
  test.slow();
  await signIn(page, "fixture-member@sandhi.test", "/portal");
  await expect(page).toHaveURL(/\/portal$/u);

  // Their own page is still reachable on purpose, with no prompt on it.
  await page.goto("/portal/profile");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("One last thing before the portal opens"),
  ).toHaveCount(0);
  await expect(page.getByText("Still needed:")).toHaveCount(0);
});
