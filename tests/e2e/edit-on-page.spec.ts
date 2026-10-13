import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

const AREA = "/research/areas/ai-for-science";
const QUESTION = `Fixture question ${Date.now()}?`;

test("an administrator corrects a page where it is read, and nobody else is offered to", async ({
  page,
  browser,
}) => {
  test.slow();
  const db = createPrismaClient();
  const before = await db.researchArea.findUniqueOrThrow({
    where: { slug: "ai-for-science" },
    select: { questions: true },
  });

  try {
    await signIn(page, "fixture-admin@sandhi.test", AREA);
    const bar = page.getByLabel("Administration", { exact: true });
    await bar.getByRole("button", { name: "Edit this area" }).click();
    await bar.getByLabel("Open questions").fill(QUESTION);
    await bar.getByRole("button", { name: "Save changes" }).click();
    await expect(bar.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    // The page below the editor is the public one, already showing the change.
    await expect(
      page.getByRole("listitem").filter({ hasText: QUESTION }),
    ).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(AREA);
    await expect(visitor.getByText(QUESTION)).toBeVisible();
    await expect(
      visitor.getByLabel("Administration", { exact: true }),
    ).toHaveCount(0);
    await visitor.context().close();

    const member = await (await browser.newContext()).newPage();
    await signIn(member, "fixture-member@sandhi.test", AREA);
    await expect(
      member.getByLabel("Administration", { exact: true }),
    ).toHaveCount(0);
    await member.context().close();
  } finally {
    // Put back through the editor, so the cached public page is put back too.
    const bar = page.getByLabel("Administration", { exact: true });
    await bar.getByLabel("Open questions").fill(before.questions.join("\n"));
    await bar.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: QUESTION }),
    ).toHaveCount(0, { timeout: 15_000 });
    await db.$disconnect();
  }
});

test("a record added from a page keeps its author on that page, and is offered there until it is published", async ({
  page,
}) => {
  test.slow();
  const title = `Fixture on-page post ${Date.now()}`;
  const db = createPrismaClient();

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/news");
    const bar = page.getByLabel("Administration", { exact: true });
    await bar.getByRole("button", { name: "Add news" }).click();
    await bar.getByLabel("Title").fill(title);
    await bar.getByLabel("Summary").fill("Made from the news page itself.");
    await bar.getByLabel("Article", { exact: true }).fill("The body.");
    await bar.getByRole("button", { name: "Create post" }).click();

    await expect(bar.getByText(/^Added\./u)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/news$/u);
    // The form is gone, so pressing Create twice cannot make two posts.
    await expect(bar.locator("form")).toHaveCount(0);
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
    await bar
      .getByRole("button", { name: `Not on the site: ${title}` })
      .click();
    await expect(bar.getByLabel("Title")).toHaveValue(title);
  } finally {
    // A draft was never in a cached public list, so the row can simply go.
    const posts = await db.newsPost.findMany({
      where: { title },
      select: { id: true },
    });
    await db.auditLog.deleteMany({
      where: { entityId: { in: posts.map(({ id }) => id) } },
    });
    await db.newsPost.deleteMany({ where: { title } });
    await db.$disconnect();
  }
});
