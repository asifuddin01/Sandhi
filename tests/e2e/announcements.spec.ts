import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/** Both tests post to the one lab-wide list. */
test.describe.configure({ mode: "serial" });

const TITLE_PREFIX = "Fixture announcement";

async function forgetAnnouncements() {
  const db = createPrismaClient();
  try {
    await db.announcement.deleteMany({
      where: { title: { startsWith: TITLE_PREFIX } },
    });
    await db.auditLog.deleteMany({
      where: { action: { startsWith: "announcement." } },
    });
  } finally {
    await db.$disconnect();
  }
}

test("an announcement reaches the lab through News, and nobody else", async ({
  page,
  browser,
}) => {
  test.slow();
  const title = `${TITLE_PREFIX} ${Date.now()}`;
  const body = "The grant closes at 23:59 on 30 September.";

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/announcements");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("What people need to know").fill(body);
    await page.getByLabel(/Pin it to the top/u).check();
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByText("Posted, and pinned to the top.")).toBeVisible({
      timeout: 30_000,
    });

    // A member reads it in the News section.
    const theirs = await browser.newContext();
    const member = await theirs.newPage();
    await signIn(member, "fixture-member@sandhi.test", "/news");
    const notices = member.getByRole("region", { name: "Lab announcements" });
    await expect(notices).toContainText(title);
    await expect(notices).toContainText(body);
    await expect(notices).toContainText("Pinned");
    await theirs.close();

    /**
     * The whole point: an announcement is not a news post. A signed-out
     * visitor must not see it, nor the section, nor any hint that one
     * exists — and the public API must not carry it either.
     */
    const outside = await browser.newContext();
    const visitor = await outside.newPage();
    await visitor.goto("/news");
    await visitor.waitForLoadState("networkidle");
    await expect(visitor.getByText(title)).toHaveCount(0);
    await expect(
      visitor.getByRole("region", { name: "Lab announcements" }),
    ).toHaveCount(0);
    expect(await (await visitor.request.get("/news")).text()).not.toContain(
      body,
    );
    expect(
      await (await visitor.request.get("/api/v1/news")).text(),
    ).not.toContain(title);
    // Nor through search, which reads the news index.
    expect(
      await (await visitor.request.get("/api/v1/search?q=Fixture")).text(),
    ).not.toContain(title);
    await outside.close();
  } finally {
    await forgetAnnouncements();
  }
});

test("taking one down removes it from the lab's view", async ({ page }) => {
  test.slow();
  const title = `${TITLE_PREFIX} removable ${Date.now()}`;

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/announcements");
    await page.getByLabel("Title").fill(title);
    await page
      .getByLabel("What people need to know")
      .fill("Fixture content used only by automated tests.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByText("Posted.")).toBeVisible({ timeout: 30_000 });

    await page.goto("/news");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("region", { name: "Lab announcements" }),
    ).toContainText(title);

    await page.goto("/admin/announcements");
    await page.waitForLoadState("networkidle");
    const row = page.getByRole("listitem").filter({ hasText: title });
    await row.getByRole("button", { name: "Take down" }).click();
    // Removing the row removes the form that would have said so. For a
    // deletion that is fine: the thing being gone is the confirmation, which
    // is not true of an invitation or a decision email, where the outcome is
    // invisible unless it is stated.
    await expect(row).toHaveCount(0, { timeout: 30_000 });

    await page.goto("/news");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(title)).toHaveCount(0);
  } finally {
    await forgetAnnouncements();
  }
});
