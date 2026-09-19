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

test("staff build a project with its team, areas, and related work", async ({
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const slug = `fixture-project-${stamp}`;
  const title = `Fixture project ${stamp}`;
  const db = createPrismaClient();

  try {
    await signIn(page, "fixture-reviewer@sandhi.test", "/admin/projects/new");
    await expectNoViolations(page);
    await page.getByLabel("Title").fill(title);
    await expect(page.getByLabel("Address")).toHaveValue(slug);
    await page.getByLabel("One-line description").fill("Cheaper attention.");
    await page
      .getByLabel("Research question")
      .fill("Can sparse attention match dense attention?");
    await page
      .getByLabel("Abstract")
      .fill("We compare sparse and dense attention.");
    await page
      .getByLabel("Approach", { exact: true })
      .fill("Train **both** on the same split.");
    await page.getByLabel("Started").fill("2026-03-01");
    await page.getByLabel("Ended").fill("2026-01-01");

    await page.getByRole("button", { name: "Add a person" }).click();
    await page
      .getByLabel("Person 1")
      .selectOption({ label: "Fixture Researcher A" });
    await page.getByLabel("Role").first().fill("Lead researcher");
    await page.getByLabel("Leads the project").first().selectOption("yes");
    await page.getByRole("button", { name: "Add a person" }).click();
    await page
      .getByLabel("Person 2")
      .selectOption({ label: "Fixture Private Researcher" });
    await page.getByLabel("Role").nth(1).fill("Engineer");

    await page.getByLabel("Language Models & NLP").check();
    await page.getByLabel("[Fixture] Public project").check();
    await page.getByLabel("State").selectOption("PUBLISHED");

    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText(/cannot end before it starts/u)).toBeVisible();
    // The refusal kept the team as entered.
    await expect(page.getByLabel("Person 2")).toBeVisible();

    await page.getByLabel("Ended").fill("");
    await page
      .getByLabel("Person 2")
      .selectOption({ label: "Fixture Researcher A" });
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText(/appear on the team once/u)).toBeVisible();
    await page
      .getByLabel("Person 2")
      .selectOption({ label: "Fixture Private Researcher" });
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/admin\/projects\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });
    const id = new URL(page.url()).pathname.split("/").pop()!;

    const saved = await db.project.findUniqueOrThrow({
      where: { id },
      include: {
        members: { orderBy: { sortOrder: "asc" }, include: { member: true } },
        areas: true,
        relatedFrom: { include: { to: true } },
      },
    });
    expect(
      saved.members.map(({ member, role, isLead }) => [
        member.name,
        role,
        isLead,
      ]),
    ).toEqual([
      ["Fixture Researcher A", "Lead researcher", true],
      ["Fixture Private Researcher", "Engineer", false],
    ]);
    expect(saved.areas).toHaveLength(1);
    expect(saved.relatedFrom.map(({ to }) => to.slug)).toEqual([
      "fixture-public-project",
    ]);

    // Public: the project, its public member, and its related project;
    // never the private member.
    const live = await request.get(`/projects/${slug}`);
    expect(live.status()).toBe(200);
    const html = await live.text();
    expect(html).toContain("Cheaper attention.");
    expect(html).toContain("Fixture Researcher A");
    expect(html).not.toContain("Fixture Private Researcher");
    expect(html).toContain("[Fixture] Public project");

    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    await page.goto(`/admin/projects?q=${slug}`);
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
    await page.getByLabel(`Select ${title}`).check();
    await page.getByLabel("With selected projects").selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    expect((await request.get(`/projects/${slug}`)).status()).toBe(404);
    await page.getByLabel(`Select ${title}`).check();
    await page.getByLabel("With selected projects").selectOption("delete");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 deleted.")).toBeVisible();
    expect(await db.project.count({ where: { id } })).toBe(0);
    expect(await db.projectMember.count({ where: { projectId: id } })).toBe(0);
  } finally {
    const projects = await db.project.findMany({
      where: { slug },
      select: { id: true },
    });
    const ids = projects.map(({ id }) => id);
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.project.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
