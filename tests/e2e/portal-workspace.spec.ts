import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/** These all write experiments the others would otherwise read. */
test.describe.configure({ mode: "serial" });

const PREFIX = "[Fixture] Experiment";

async function forgetExperiments() {
  const db = createPrismaClient();
  try {
    await db.experiment.deleteMany({ where: { name: { startsWith: PREFIX } } });
  } finally {
    await db.$disconnect();
  }
}

test("a member records an experiment, logs against it, and deletes it", async ({
  page,
}) => {
  test.slow();
  const name = `${PREFIX} ${Date.now()}`;

  try {
    await signIn(page, "fixture-member@sandhi.test", "/portal/workspace");

    await page.getByLabel("Name", { exact: true }).fill(name);
    await page
      .getByLabel("Hypothesis", { exact: true })
      .fill("Smaller batches settle sooner.");
    await page
      .getByLabel("Configuration", { exact: true })
      .fill('{"lr": 0.001, "batch": 16}');
    await page
      .getByLabel("Datasets", { exact: true })
      .fill("bn-corpus-v2\nbn-corpus-v2");
    await page.getByLabel("Results", { exact: true }).fill('{"f1": 0.81}');
    await page.getByRole("button", { name: "Record it" }).click();
    await expect(page.getByText("Experiment recorded.")).toBeVisible();

    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    // Scoped to the record, because the edit form below holds the same
    // values in its boxes.
    const record = page.getByRole("region", { name: "What was tried" });
    // JSON is shown as text, laid out — not as the one line it was typed on.
    await expect(record.locator("pre").first()).toContainText('"lr": 0.001');
    // The duplicate dataset was recorded once.
    await expect(
      record.getByText("bn-corpus-v2", { exact: true }),
    ).toBeVisible();

    await expect(page.getByText("Nothing logged yet.")).toBeVisible();
    await page
      .getByLabel("Add to the log", { exact: true })
      .fill("First run crashed at epoch 3.");
    await page.getByRole("button", { name: "Log it" }).click();
    await expect(page.getByText("Logged.")).toBeVisible();
    await expect(page.getByText("First run crashed at epoch 3.")).toBeVisible();

    // Configuration that will not parse is refused, and says so plainly.
    await page.getByLabel("Configuration", { exact: true }).fill("{lr: 0.001}");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("The configuration is not valid JSON."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete this experiment" }).click();
    await page.waitForURL(/\/portal\/workspace$/u, { timeout: 30_000 });
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  } finally {
    await forgetExperiments();
  }
});

test("somebody on no project is not offered the form", async ({ page }) => {
  await signIn(page, "fixture-staff@sandhi.test", "/portal/workspace");
  await expect(
    page.getByRole("heading", { name: "Research workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Record an experiment" }),
  ).toHaveCount(0);
});

test("an experiment on a project you are not on cannot be reached", async ({
  page,
}) => {
  const db = createPrismaClient();
  let id = "";
  try {
    const membership = await db.projectMember.findFirst({
      where: { member: { slug: "fixture-member" } },
      select: { projectId: true, memberId: true },
    });
    const experiment = await db.experiment.create({
      data: {
        name: `${PREFIX} private`,
        projectId: membership!.projectId,
        ownerId: membership!.memberId,
      },
      select: { id: true },
    });
    id = experiment.id;
  } finally {
    await db.$disconnect();
  }

  try {
    await signIn(page, "fixture-staff@sandhi.test", "/portal/workspace");
    const response = await page.goto(`/portal/workspace/${id}`);
    expect(response?.status()).toBe(404);
  } finally {
    await forgetExperiments();
  }
});
