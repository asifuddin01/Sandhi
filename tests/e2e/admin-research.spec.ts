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

test("administrators shape research themes and areas without breaking links", async ({
  browser,
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const themeSlug = `fixture-theme-${stamp}`;
  const areaSlug = `fixture-area-${stamp}`;
  const renamedSlug = `fixture-area-renamed-${stamp}`;
  const db = createPrismaClient();
  let opportunityId: string | null = null;

  try {
    const reviewer = await browser.newPage();
    try {
      await signIn(reviewer, "fixture-reviewer@sandhi.test", "/admin");
      expect((await reviewer.request.get("/admin/research")).status()).toBe(
        404,
      );
    } finally {
      await reviewer.context().close();
    }

    await signIn(page, "fixture-admin@sandhi.test", "/admin/research/new");
    await expectNoViolations(page);
    await page
      .getByLabel("Name", { exact: true })
      .fill(`Fixture theme ${stamp}`);
    await expect(page.getByLabel("Address")).toHaveValue(themeSlug);
    await page.getByLabel("Short description").fill("Systems that learn.");
    await page.getByLabel("State").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create theme" }).click();
    await expect(page).toHaveURL(/\/admin\/research\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });
    const themeId = new URL(page.url()).pathname.split("/").pop()!;
    expect((await request.get(`/research/${themeSlug}`)).status()).toBe(200);

    await page.goto("/admin/research/areas/new");
    await page.waitForLoadState("networkidle");
    await page
      .getByLabel("Name", { exact: true })
      .fill(`Fixture area ${stamp}`);
    await page.getByLabel("Theme", { exact: true }).selectOption(themeId);
    await page.getByLabel("Summary").fill("Where fixtures live.");
    await page.getByLabel("Open questions").fill("Why?\nHow?");
    await page.getByLabel("State").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create area" }).click();
    await expect(page).toHaveURL(
      /\/admin\/research\/areas\/[^/]+\?created=1$/u,
      {
        timeout: 30_000,
      },
    );
    const areaId = new URL(page.url()).pathname.split("/").pop()!;
    const areaPage = await request.get(`/research/areas/${areaSlug}`);
    expect(areaPage.status()).toBe(200);
    expect(await areaPage.text()).toContain("How?");

    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `Fixture area ${stamp}`,
    );

    // An opportunity names the area by address; renaming carries it along.
    const opportunity = await db.opportunity.create({
      data: {
        slug: `fixture-opportunity-area-${stamp}`,
        title: "Fixture area opportunity",
        kind: "INTERNSHIP",
        description: "Test.",
        areaSlugs: [areaSlug],
      },
    });
    opportunityId = opportunity.id;
    await page.goto(`/admin/research/areas/${areaId}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Address").fill(renamedSlug);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    const followed = await db.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
    });
    expect(followed.areaSlugs).toEqual([renamedSlug]);

    // A theme with areas, and an area with linked work, are never deleted.
    await db.projectArea.create({
      data: {
        areaId,
        projectId: (
          await db.project.findFirstOrThrow({
            where: { slug: "fixture-public-project" },
          })
        ).id,
      },
    });
    await page.goto(`/admin/research/areas?q=${stamp}`);
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
    await page.getByLabel(`Select Fixture area ${stamp}`).check();
    await page.getByLabel("With selected areas").selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    await page.getByLabel(`Select Fixture area ${stamp}`).check();
    await page.getByLabel("With selected areas").selectOption("delete");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(/linked to projects/u)).toBeVisible();

    await page.goto(`/admin/research?q=${stamp}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel(`Select Fixture theme ${stamp}`).check();
    await page.getByLabel("With selected themes").selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    await page.getByLabel(`Select Fixture theme ${stamp}`).check();
    await page.getByLabel("With selected themes").selectOption("delete");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(/still has research areas/u)).toBeVisible();
    expect(await db.researchTheme.count({ where: { id: themeId } })).toBe(1);
  } finally {
    if (opportunityId) {
      await db.opportunity.deleteMany({ where: { id: opportunityId } });
    }
    const areas = await db.researchArea.findMany({
      where: { slug: { in: [areaSlug, renamedSlug] } },
      select: { id: true },
    });
    const themes = await db.researchTheme.findMany({
      where: { slug: themeSlug },
      select: { id: true },
    });
    const ids = [...areas, ...themes].map(({ id }) => id);
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.projectArea.deleteMany({
      where: { areaId: { in: areas.map(({ id }) => id) } },
    });
    await db.researchArea.deleteMany({
      where: { id: { in: areas.map(({ id }) => id) } },
    });
    await db.researchTheme.deleteMany({
      where: { id: { in: themes.map(({ id }) => id) } },
    });
    await db.$disconnect();
  }
});
