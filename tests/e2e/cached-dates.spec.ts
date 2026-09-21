import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/**
 * Public reads are cached, and a cache stores JSON — so a `Date` put in comes
 * back out as a string. The first request after a fill looks perfect and
 * every one after it throws on `.toISOString()`.
 *
 * That reached main once, hidden because the fixture database has no
 * published insights, publications or news: the date code never ran. These
 * tests create dated rows of each kind and read every page that renders one
 * **twice**, so the second read comes from a warm cache. A single read would
 * pass against the bug.
 */
test.describe.configure({ mode: "serial" });

const PREFIX = "[Fixture dated]";

async function withDatedContent(run: () => Promise<void>) {
  const db = createPrismaClient();
  const stamp = Date.now();
  const ids = {
    insight: `fixture-dated-insight-${stamp}`,
    news: `fixture-dated-news-${stamp}`,
    publication: `fixture-dated-publication-${stamp}`,
  };
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    await db.insight.create({
      data: {
        id: ids.insight,
        slug: ids.insight,
        title: `${PREFIX} insight`,
        summary: "Fixture content used only by automated tests.",
        body: "Fixture content used only by automated tests.",
        kind: "TECHNICAL_NOTE",
        state: "PUBLISHED",
        publishedAt: yesterday,
      },
    });
    await db.newsPost.create({
      data: {
        id: ids.news,
        slug: ids.news,
        title: `${PREFIX} news`,
        excerpt: "Fixture content used only by automated tests.",
        body: "Fixture content used only by automated tests.",
        category: "RESEARCH",
        state: "PUBLISHED",
        publishAt: yesterday,
      },
    });
    await db.publication.create({
      data: {
        id: ids.publication,
        slug: ids.publication,
        title: `${PREFIX} publication`,
        abstract: "Fixture content used only by automated tests.",
        type: "JOURNAL",
        stage: "PUBLISHED",
        state: "PUBLISHED",
        year: 2026,
        publishedAt: yesterday,
      },
    });
    await run();
  } finally {
    await db.insight.deleteMany({ where: { id: ids.insight } });
    await db.newsPost.deleteMany({ where: { id: ids.news } });
    await db.publication.deleteMany({ where: { id: ids.publication } });
    await db.$disconnect();
  }
}

test("every page that renders a cached date survives a warm cache", async ({
  request,
}) => {
  test.slow();
  await withDatedContent(async () => {
    for (const path of ["/insights", "/publications", "/news", "/"]) {
      // Three times: the first fills the cache, the rest read it back.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await request.get(path);
        expect(response.status(), `${path} on attempt ${attempt}`).toBe(200);
      }
    }
  });
});

test("the dated rows are actually rendered, so the date code really ran", async ({
  request,
}) => {
  test.slow();
  await withDatedContent(async () => {
    // Without this the test above would pass on empty lists, which is exactly
    // how the bug got through the first time.
    for (const [path, what] of [
      ["/insights", `${PREFIX} insight`],
      ["/publications", `${PREFIX} publication`],
      ["/news", `${PREFIX} news`],
    ] as const) {
      await request.get(path);
      const html = await (await request.get(path)).text();
      expect(html, `${path} should list ${what}`).toContain(what);
    }
  });
});
