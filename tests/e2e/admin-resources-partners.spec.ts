import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, nodes: nodes.length })),
  ).toEqual([]);
}

/**
 * Public reads are cached and every administrative mutation expires the tags
 * it touches. This proves the second half actually reaches the first: the
 * index is read *before* the change, so the entry is warm and a stale one
 * would still be serving the old list afterwards.
 */
test("a published resource appears at once, not when the cache expires", async ({
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const slug = `fixture-cached-${stamp}`;
  const name = `Fixture cached ${stamp}`;
  const db = createPrismaClient();

  try {
    // Warm it, with the resource not yet in existence.
    const before = await (await request.get("/resources")).text();
    expect(before).not.toContain(name);

    await signIn(page, "fixture-reviewer@sandhi.test", "/admin/resources/new");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page
      .getByLabel("Description", { exact: true })
      .fill("Fixture content used only by automated tests.");
    await page.getByLabel("Kind").selectOption("BENCHMARK");
    await page.getByLabel("State").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create resource" }).click();
    await expect(page).toHaveURL(/\/admin\/resources\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });

    const after = await (await request.get("/resources")).text();
    expect(after).toContain(name);
  } finally {
    await db.resource.deleteMany({ where: { slug } });
    await db.$disconnect();
  }
});

test("staff publish resources with safe links and research areas", async ({
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const slug = `fixture-resource-${stamp}`;
  const name = `Fixture resource ${stamp}`;
  const db = createPrismaClient();

  try {
    await signIn(page, "fixture-reviewer@sandhi.test", "/admin/resources/new");
    await expectNoViolations(page);
    await page.getByLabel("Name", { exact: true }).fill(name);
    await expect(page.getByLabel("Address")).toHaveValue(slug);
    await page
      .getByLabel("Description", { exact: true })
      .fill("A benchmark for **multilingual** reasoning.");
    await page.getByLabel("Kind").selectOption("BENCHMARK");
    await page.getByLabel("Repository link").fill("http://github.com/insecure");
    await page.getByLabel("Computer Vision").check();
    await page.getByLabel("State").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create resource" }).click();
    await expect(
      page.getByText(/needs a full https:\/\/ address/u),
    ).toBeVisible();
    // The refusal kept everything typed, including the ticked area.
    await expect(page.getByLabel("Computer Vision")).toBeChecked();

    await page
      .getByLabel("Repository link")
      .fill("https://github.com/sandhi-fixture/benchmark");
    await page.getByRole("button", { name: "Create resource" }).click();
    await expect(page).toHaveURL(/\/admin\/resources\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });
    const id = new URL(page.url()).pathname.split("/").pop()!;

    const live = await request.get(`/resources/${slug}`);
    expect(live.status()).toBe(200);
    const html = await live.text();
    expect(html).toContain("https://github.com/sandhi-fixture/benchmark");
    expect(html).toContain("Computer Vision");

    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

    await page.goto(`/admin/resources?q=${slug}`);
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
    await page.getByLabel(`Select ${name}`).check();
    await page.getByLabel("With selected resources").selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    expect((await request.get(`/resources/${slug}`)).status()).toBe(404);
    await page.getByLabel(`Select ${name}`).check();
    await page.getByLabel("With selected resources").selectOption("delete");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 deleted.")).toBeVisible();
    expect(await db.resource.count({ where: { id } })).toBe(0);
    // Its research-area links went with it.
    expect(await db.resourceArea.count({ where: { resourceId: id } })).toBe(0);
  } finally {
    const resources = await db.resource.findMany({
      where: { slug },
      select: { id: true },
    });
    const ids = resources.map(({ id }) => id);
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.resource.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});

test("administrators manage partners shown on the Partners page", async ({
  browser,
  page,
  request,
}) => {
  const name = `Fixture Partner ${Date.now()}`;
  const db = createPrismaClient();

  try {
    const reviewer = await browser.newPage();
    try {
      await signIn(reviewer, "fixture-reviewer@sandhi.test", "/admin");
      expect((await reviewer.request.get("/admin/partners")).status()).toBe(
        404,
      );
    } finally {
      await reviewer.context().close();
    }

    await signIn(page, "fixture-admin@sandhi.test", "/admin/partners/new");
    await expectNoViolations(page);
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Kind").selectOption("LAB");
    await page
      .getByLabel("Description")
      .fill("A fixture lab we work with on evaluation.");
    await page.getByLabel("Website").fill("https://partner.example");
    await page.getByLabel("State").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Add partner" }).click();
    await expect(page).toHaveURL(/\/admin\/partners\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });

    expect(await (await request.get("/partners")).text()).toContain(name);

    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.goto(`/admin/partners?q=${encodeURIComponent(name)}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel(`Select ${name}`).check();
    await page.getByLabel("With selected partners").selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    expect(await (await request.get("/partners")).text()).not.toContain(name);
  } finally {
    const partners = await db.partner.findMany({
      where: { name },
      select: { id: true },
    });
    const ids = partners.map(({ id }) => id);
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.partner.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
