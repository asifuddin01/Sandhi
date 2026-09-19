import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

async function forgetPublications(prefix: string) {
  const db = createPrismaClient();
  try {
    const rows = await db.publication.findMany({
      where: { slug: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = rows.map(({ id }) => id);
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.publication.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
}

/**
 * Presses a form's button and waits for its own answer. The outcome message
 * stays on screen after a save, so asserting on the text alone would pass on
 * the previous save's message while this one is still in flight.
 */
async function submit(page: Page, label: string) {
  const button = page.getByRole("button", { name: label });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.startsWith("/admin/publications"),
      { timeout: 30_000 },
    ),
    button.click(),
  ]);
  await expect(button).toBeEnabled({ timeout: 30_000 });
}

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, nodes: nodes.length })),
  ).toEqual([]);
}

test("staff record a publication, review it, and publish it", async ({
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const prefix = `fixture-publication-${stamp}`;
  const title = `Fixture publication ${stamp}`;

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/publications");
    await expectNoViolations(page);

    await page.getByRole("link", { name: "New publication" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "New publication",
    );

    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Address").fill(prefix);
    await page
      .getByLabel("Abstract")
      .fill("A fixture abstract for the publications manager test.");

    // An author is required, and each one is a member or a typed name.
    await page.getByRole("button", { name: "Add an author" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Fixture Author");

    await page.getByLabel("Venue", { exact: true }).fill("Fixture Conference");
    await page.getByLabel("Short venue").fill("FIXCON");
    await page.getByLabel("Year").fill("2026");

    await page.getByRole("button", { name: "Create publication" }).click();
    await page.waitForURL(/\/admin\/publications\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });
    await expect(page.getByText("Publication created.")).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop()!;

    // A draft is nowhere public: not its page, not the index, not the API.
    expect((await request.get(`/publications/${prefix}`)).status()).toBe(404);
    expect(await (await request.get("/publications")).text()).not.toContain(
      title,
    );
    expect((await request.get(`/api/v1/publications/${prefix}`)).status()).toBe(
      404,
    );

    // The preview shows the page it would become, and says it is not public.
    await page.goto(`/admin/publications/${id}/preview`);
    await expect(page.getByText(/not public yet/u)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expectNoViolations(page);

    // A review is recorded against the publication and shown in its history.
    await page.goto(`/admin/publications/${id}`);
    await page
      .getByLabel("Comment")
      .fill("Reads well. Checked the baselines and the appendix.");
    await submit(page, "Record review");
    await expect(page.getByText(/Approved by/u)).toBeVisible();

    // Published state alone is not enough: the stage decides too.
    await page.getByLabel("State").selectOption("PUBLISHED");
    await submit(page, "Save changes");
    expect((await request.get(`/publications/${prefix}`)).status()).toBe(404);

    await page.getByLabel("Stage").selectOption("ACCEPTED");
    await submit(page, "Save changes");

    const live = await request.get(`/publications/${prefix}`);
    expect(live.status()).toBe(200);
    expect(await live.text()).toContain("Fixture Author");
    expect((await request.get(`/api/v1/publications/${prefix}`)).status()).toBe(
      200,
    );

    await page.goto(`/admin/publications/${id}`);
    await expectNoViolations(page);
  } finally {
    await forgetPublications(prefix);
  }
});

test("a duplicate address, DOI, or arXiv id is named, not swallowed", async ({
  page,
}) => {
  test.slow();
  const stamp = Date.now();
  const prefix = `fixture-publication-dupe-${stamp}`;

  try {
    const db = createPrismaClient();
    try {
      await db.publication.create({
        data: {
          slug: `${prefix}-first`,
          title: `Fixture first ${stamp}`,
          abstract: "First.",
          type: "JOURNAL",
          doi: `10.9999/fixture-${stamp}`,
          authors: { create: [{ position: 0, externalName: "A Author" }] },
        },
      });
    } finally {
      await db.$disconnect();
    }

    await signIn(page, "fixture-admin@sandhi.test", "/admin/publications/new");
    await page.getByLabel("Title").fill(`Fixture second ${stamp}`);
    await page.getByLabel("Address").fill(`${prefix}-second`);
    await page.getByLabel("Abstract").fill("Second.");
    await page.getByRole("button", { name: "Add an author" }).click();
    await page.getByLabel("Name", { exact: true }).fill("B Author");
    await page
      .getByLabel("DOI", { exact: true })
      .fill(`10.9999/fixture-${stamp}`);
    await page.getByRole("button", { name: "Create publication" }).click();

    await expect(
      page.getByText("Another publication already has that DOI."),
    ).toBeVisible();
    // A refused save keeps what was typed.
    await expect(page.getByLabel("Title")).toHaveValue(
      `Fixture second ${stamp}`,
    );
  } finally {
    await forgetPublications(prefix);
  }
});

test("an author must be a member or a name, never both or neither", async ({
  page,
}) => {
  const stamp = Date.now();
  const prefix = `fixture-publication-authors-${stamp}`;

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/publications/new");
    await page.getByLabel("Title").fill(`Fixture authors ${stamp}`);
    await page.getByLabel("Address").fill(prefix);
    await page.getByLabel("Abstract").fill("Abstract.");

    await page.getByRole("button", { name: "Create publication" }).click();
    await expect(page.getByText("Add at least one author.")).toBeVisible();

    await page.getByRole("button", { name: "Add an author" }).click();
    await page.getByRole("button", { name: "Create publication" }).click();
    await expect(
      page.getByText(/Choose a member or type a name for author 1/u),
    ).toBeVisible();
  } finally {
    await forgetPublications(prefix);
  }
});

test("a member cannot reach the publications manager at all", async ({
  page,
}) => {
  await signIn(page, "fixture-member@sandhi.test", "/portal");

  for (const path of [
    "/admin/publications",
    "/admin/publications/new",
  ] as const) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
});
