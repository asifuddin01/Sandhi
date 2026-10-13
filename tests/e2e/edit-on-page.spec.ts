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

test("a record moved or taken off the site from its own page is followed, not lost", async ({
  page,
}) => {
  test.slow();
  await signIn(page, "fixture-admin@sandhi.test", AREA);
  const bar = page.getByLabel("Administration", { exact: true });
  const save = async (label: string, change: () => Promise<unknown>) => {
    await bar.getByRole("button", { name: label }).click();
    await change();
    await bar.getByRole("button", { name: "Save changes" }).click();
  };

  try {
    await save("Edit this area", () =>
      bar.getByLabel("Address").fill("ai-for-science-moved"),
    );
    await expect(page).toHaveURL(/\/research\/areas\/ai-for-science-moved$/u, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "AI for Science",
    );

    await save("Edit this area", () =>
      bar.getByLabel("State").selectOption("DRAFT"),
    );
    // Its page is gone, so the list it belongs to is where it is offered.
    await expect(page).toHaveURL(/\/research$/u, { timeout: 15_000 });
    await expect(
      bar.getByRole("button", { name: "Not on the site: AI for Science" }),
    ).toBeVisible();
  } finally {
    // Back through the editor, so the cached public pages are put back too.
    await page.goto("/research");
    const hidden = bar.getByRole("button", {
      name: "Not on the site: AI for Science",
    });
    if (await hidden.count()) {
      await save("Not on the site: AI for Science", async () => {
        await bar.getByLabel("Address").fill("ai-for-science");
        await bar.getByLabel("State").selectOption("PUBLISHED");
      });
      await expect(hidden).toHaveCount(0, { timeout: 15_000 });
    } else {
      await page.goto("/research/areas/ai-for-science-moved");
      if (await bar.getByRole("button", { name: "Edit this area" }).count()) {
        await save("Edit this area", () =>
          bar.getByLabel("Address").fill("ai-for-science"),
        );
        await expect(page).toHaveURL(/ai-for-science$/u, { timeout: 15_000 });
      }
    }
  }
});

test("who is on People is chosen on People, and from a profile", async ({
  page,
}) => {
  test.slow();
  const name = "Fixture Researcher A";
  await signIn(page, "fixture-admin@sandhi.test", "/people");
  const bar = page.getByLabel("Administration", { exact: true });
  const card = page.getByRole("main").getByRole("link", { name });
  const show = bar.getByRole("button", { name: `Show ${name} on People` });

  try {
    await bar.getByRole("button", { name: "Invite someone" }).click();
    await expect(bar.getByLabel("Email")).toBeVisible();

    await bar.getByRole("button", { name: "Choose who is shown" }).click();
    await bar.getByRole("button", { name: `Hide ${name} from People` }).click();
    await expect(card).toHaveCount(0, { timeout: 15_000 });
    await show.click();
    await expect(card).not.toHaveCount(0, { timeout: 15_000 });

    // Hidden from their own profile, which then no longer exists.
    await card.first().click();
    await page.getByRole("button", { name: "Hide from People" }).click();
    await expect(page).toHaveURL(/\/people$/u, { timeout: 15_000 });
    await expect(card).toHaveCount(0);
  } finally {
    await page.goto("/people");
    await bar.getByRole("button", { name: "Choose who is shown" }).click();
    if (await show.count()) {
      await show.click();
      await expect(card).not.toHaveCount(0, { timeout: 15_000 });
    }
  }
});

test("a reviewer publishes a note from Insights and withdraws it from its own page", async ({
  page,
}) => {
  test.slow();
  const title = `Fixture on-page note ${Date.now()}`;
  const slug = title.toLowerCase().replaceAll(" ", "-");
  const db = createPrismaClient();
  const author = await db.member.findUniqueOrThrow({
    where: { slug: "fixture-member" },
    select: { id: true },
  });
  const note = await db.insight.create({
    data: {
      slug,
      title,
      summary: "Handed over and waiting to be read.",
      body: "The body of the note.",
      kind: "FINDING",
      state: "IN_REVIEW",
      authors: { create: [{ memberId: author.id, position: 0 }] },
    },
    select: { id: true },
  });

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/insights");
    const bar = page.getByLabel("Administration", { exact: true });
    const listed = page.getByRole("main").getByRole("link", { name: title });
    await bar
      .getByRole("button", { name: /^Review notes \(\d+ waiting\)$/u })
      .click();
    await bar
      .getByRole("region", { name: title })
      .getByRole("button", { name: "Publish it" })
      .click();
    await expect(listed).not.toHaveCount(0, { timeout: 15_000 });

    await listed.first().click();
    await expect(page).toHaveURL(new RegExp(`/insights/${slug}$`, "u"));
    await bar.getByRole("button", { name: "Withdraw this note" }).click();
    await bar.getByRole("button", { name: "Withdraw it" }).click();
    // Its page is gone, so the reviewer is back on the list, without it.
    await expect(page).toHaveURL(/\/insights$/u, { timeout: 15_000 });
    await expect(listed).toHaveCount(0);
  } finally {
    // Withdrawn through the action above, so no cached list still shows it.
    await db.auditLog.deleteMany({ where: { entityId: note.id } });
    await db.insight.delete({ where: { id: note.id } });
    await db.$disconnect();
  }
});
