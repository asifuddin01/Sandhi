import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";
import { toDhakaInput } from "../../lib/dhaka-time";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

async function forgetPosts(prefix: string) {
  const db = createPrismaClient();
  try {
    const posts = await db.newsPost.findMany({
      where: { slug: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = posts.map(({ id }) => id);
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.newsPost.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
}

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, nodes: nodes.length })),
  ).toEqual([]);
}

test("staff write, preview, schedule, publish, and archive news", async ({
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const prefix = `fixture-news-${stamp}`;
  const title = `Fixture news ${stamp}`;
  const db = createPrismaClient();

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/news/new");
    await expectNoViolations(page);

    await page.getByLabel("Title").fill(title);
    await expect(page.getByLabel("Address")).toHaveValue(prefix);
    await page.getByLabel("Summary").fill("A fixture post for the tests.");
    await page
      .getByLabel("Article", { exact: true })
      .fill(
        "Some **bold** words, maths $x^2$, and <script>window.hacked = true</script>.",
      );

    // The live preview renders on the server, sanitised like the public page.
    const preview = page.getByRole("region", { name: "Article preview" });
    await expect(preview.locator("strong")).toHaveText("bold");
    await expect(preview.locator(".katex").first()).toBeVisible();
    await expect(preview.locator("script")).toHaveCount(0);
    expect(await page.evaluate(() => "hacked" in window)).toBe(false);

    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page).toHaveURL(/\/admin\/news\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });
    await expect(page.getByText("Post created.")).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop()!;

    // A draft stays private, but the preview shows the real page.
    expect((await request.get(`/news/${prefix}`)).status()).toBe(404);
    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByText(/not public yet/u)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.getByRole("link", { name: "Back to editing" }).click();
    await page.waitForLoadState("networkidle");

    // Scheduling needs a future time, and a refusal keeps what was typed.
    await page.getByLabel("State").selectOption("SCHEDULED");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Choose when it should be published."),
    ).toBeVisible();
    await expect(page.getByLabel("State")).toHaveValue("SCHEDULED");
    await page
      .getByLabel("Publish time (Dhaka)")
      .fill(toDhakaInput(new Date(Date.now() - 60 * 60 * 1000)));
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/publish time in the future/u)).toBeVisible();
    await page
      .getByLabel("Publish time (Dhaka)")
      .fill(toDhakaInput(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto(`/admin/news?q=${prefix}`);
    await expect(page.getByText(/^Scheduled for /u)).toBeVisible();
    expect((await request.get(`/news/${prefix}`)).status()).toBe(404);

    // When its time comes, it is public without anyone acting.
    await db.newsPost.update({
      where: { id },
      data: { publishAt: new Date(Date.now() - 60 * 1000) },
    });
    const live = await request.get(`/news/${prefix}`);
    expect(live.status()).toBe(200);
    expect(await live.text()).toContain(title);

    // A second post cannot take the same address.
    await page.goto("/admin/news/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Summary").fill("Duplicate.");
    await page.getByLabel("Article", { exact: true }).fill("Duplicate.");
    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page.getByText(/already uses that address/u)).toBeVisible();

    // Bulk archive hides it; bulk delete removes archived posts only.
    await page.goto(`/admin/news?q=${prefix}`);
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
    await page.getByLabel(`Select ${title}`).check();
    await page.getByLabel("With selected posts").selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    expect((await request.get(`/news/${prefix}`)).status()).toBe(404);

    await page.getByLabel(`Select ${title}`).check();
    await page.getByLabel("With selected posts").selectOption("delete");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 deleted.")).toBeVisible();
    expect(await db.newsPost.count({ where: { id } })).toBe(0);

    const actions = (
      await db.auditLog.findMany({
        where: { entityId: id },
        orderBy: { createdAt: "asc" },
        select: { action: true },
      })
    ).map(({ action }) => action);
    expect(actions).toEqual([
      "news.create",
      "news.update",
      "news.archive",
      "news.delete",
    ]);
  } finally {
    await db.$disconnect();
    await forgetPosts(prefix);
  }
});

test("reviewers manage news; members cannot, even by posting directly", async ({
  browser,
  page,
  baseURL,
}) => {
  const slug = `fixture-news-escalation-${Date.now()}`;

  await signIn(page, "fixture-reviewer@sandhi.test", "/admin/news");
  await expect(page.getByRole("heading", { name: "News" })).toBeVisible();

  // Genuine action references from the editor.
  const html = await (await page.request.get("/admin/news/new")).text();
  const form = html
    .split("<form")
    .find((segment) => segment.includes('name="excerpt"'));
  const fields = Object.fromEntries(
    Array.from(
      (form ?? "").matchAll(
        /<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gu,
      ),
      (match) => [
        match[1]!,
        (match[2] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
      ],
    ),
  );
  expect(Object.keys(fields).length).toBeGreaterThan(0);

  const member = await browser.newPage();
  try {
    await signIn(member, "fixture-member@sandhi.test", "/portal");
    expect((await member.request.get("/admin/news")).status()).toBe(404);
    await member.request.post("/admin/news/new", {
      headers: { Origin: new URL(baseURL!).origin },
      multipart: {
        ...fields,
        title: "Injected",
        slug,
        excerpt: "Injected",
        body: "Injected",
        category: "ANNOUNCEMENTS",
        state: "PUBLISHED",
      },
    });
    const db = createPrismaClient();
    try {
      expect(await db.newsPost.count({ where: { slug } })).toBe(0);
    } finally {
      await db.$disconnect();
    }
  } finally {
    await member.context().close();
    await forgetPosts(slug);
  }
});
