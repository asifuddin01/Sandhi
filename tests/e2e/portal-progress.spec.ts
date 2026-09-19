import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

const PROJECT = "fixture-team-project";

async function forgetSections(prefix: string) {
  const db = createPrismaClient();
  try {
    await db.projectSection.deleteMany({
      where: { title: { startsWith: prefix } },
    });
    await db.project.updateMany({
      where: { slug: PROJECT },
      data: { phase: null },
    });
  } finally {
    await db.$disconnect();
  }
}

async function forgetUpdates(prefix: string) {
  const db = createPrismaClient();
  try {
    await db.projectUpdate.deleteMany({
      where: { title: { startsWith: prefix } },
    });
  } finally {
    await db.$disconnect();
  }
}

/**
 * Server actions answer the POST that carried them, so waiting for that
 * response is what makes "the save finished" true rather than hopeful.
 */
async function submit(page: Page, name: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        new URL(candidate.url()).pathname === `/portal/projects/${PROJECT}`,
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name, exact: true }).click(),
  ]);
  expect(response.status()).toBeLessThan(400);
}

test("a team writes an update, publishes it, and the public page shows it", async ({
  page,
}) => {
  test.slow();
  const title = `Fixture update ${Date.now()}`;

  try {
    await signIn(page, "fixture-member@sandhi.test", "/portal/projects");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "My projects",
    );

    await page.getByRole("link", { name: "[Fixture] Team project" }).click();
    await page.waitForURL(new RegExp(`/portal/projects/${PROJECT}$`, "u"), {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "[Fixture] Team project",
    );

    // "Heading" labels the section editor too, so the update form is named.
    const updateForm = page.getByRole("region", { name: "Post an update" });
    await updateForm.getByLabel("Heading").fill(title);
    await page
      .getByLabel("What happened")
      .fill("The pilot round is done and agreement is where we hoped.");
    await page
      .getByLabel("What comes next")
      .fill("Adjudicate the discourse-marker cases.");
    await submit(page, "Post update");

    const entry = page.getByRole("listitem").filter({ hasText: title });
    await expect(entry).toContainText("internal");
    await expect(entry).toContainText("at Under way");

    // An update is written for the team; nothing reaches the public page
    // until someone publishes it deliberately.
    await page.goto(`/projects/${PROJECT}`);
    await expect(page.getByText(title)).toHaveCount(0);

    await page.goto(`/portal/projects/${PROJECT}`);
    await submit(page, "Publish this update");
    await expect(
      page.getByRole("listitem").filter({ hasText: title }),
    ).toContainText("public");

    await page.goto(`/projects/${PROJECT}`);
    await expect(
      page.getByRole("heading", { name: "Progress", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(
      page.getByText("Adjudicate the discourse-marker cases."),
    ).toBeVisible();
    // The author keeps no public profile, so the update is not attributed.
    await expect(page.getByText("Fixture Member")).toHaveCount(0);

    // A table in the body is how a team reports numbers.
    await page.goto(`/portal/projects/${PROJECT}`);
    await expect(
      page.getByRole("combobox", { name: "What is it" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Attach this file" }),
    ).toBeVisible();

    await page.goto(`/projects/${PROJECT}`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    // Withdrawing takes it back off the public page.
    await page.goto(`/portal/projects/${PROJECT}`);
    await submit(page, "Make internal");
    await page.goto(`/projects/${PROJECT}`);
    await expect(page.getByText(title)).toHaveCount(0);
  } finally {
    await forgetUpdates("Fixture update ");
  }
});

test("a member cannot reach the progress page of a project they are not on", async ({
  page,
}) => {
  await signIn(page, "fixture-sessions@sandhi.test", "/portal");
  const response = await page.goto(`/portal/projects/${PROJECT}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
    "[Fixture] Team project",
  );
});

test("the team says which step the work is at, and writes the project's own account of it", async ({
  page,
}) => {
  test.slow();
  const heading = `Fixture section ${Date.now()}`;

  try {
    await signIn(
      page,
      "fixture-member@sandhi.test",
      `/portal/projects/${PROJECT}`,
    );

    // The step inside "under way" belongs to the team, not to an administrator.
    await page.getByLabel("Where the work is").selectOption("TRAINING");
    await submit(page, "Set step");
    await expect(page.getByText("Step updated.")).toBeVisible();

    const adding = page.getByRole("region", { name: "Add a section" });
    await adding.getByLabel("Heading").fill(heading);
    await adding
      .getByLabel("What it says")
      .fill("Three passes, with a drift check after a month.");
    await submit(page, "Add section");

    // A section is internal until someone publishes it, like an update.
    await page.goto(`/projects/${PROJECT}`);
    await expect(page.getByText(heading)).toHaveCount(0);

    await page.goto(`/portal/projects/${PROJECT}`);
    await submit(page, "Publish this section");

    await page.goto(`/projects/${PROJECT}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(
      page.getByText("Three passes, with a drift check after a month."),
    ).toBeVisible();
    // The finer step is drawn under the stage it belongs to.
    await expect(
      page.getByText("Training and experiments", { exact: true }),
    ).toBeVisible();

    await page.goto(`/portal/projects/${PROJECT}`);
    await submit(page, "Delete");
    await expect(page.getByText(heading)).toHaveCount(0);
  } finally {
    await forgetSections("Fixture section ");
  }
});
