import { expect, test } from "@playwright/test";

test.describe("fixture-backed public visibility", () => {
  test.skip(
    process.env.E2E_FIXTURES_READY !== "true",
    "Run migrations, seed, and seed:fixtures against an isolated test database, then set E2E_FIXTURES_READY=true.",
  );

  test("unpublished entities and private project results stay outside every public surface", async ({
    page,
    request,
  }) => {
    await page.goto("/projects");
    await expect(
      page.getByRole("link", { name: "[Fixture] Public project", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("[Fixture] Private project")).toHaveCount(0);

    await page.goto("/publications");
    await expect(
      page.getByRole("link", {
        name: "[Fixture] Visibility testing",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("[Fixture] Private publication")).toHaveCount(
      0,
    );

    await page.goto("/people");
    await expect(page.getByText("Fixture Researcher A")).toBeVisible();
    await expect(page.getByText("Fixture Private Researcher")).toHaveCount(0);

    await page.goto("/projects/fixture-public-project");
    await expect(page.getByText("Private fixture result.")).toHaveCount(0);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain("/projects/fixture-public-project");
    expect(sitemapText).toContain("/publications/fixture-publication");
    expect(sitemapText).toContain("/people/fixture-researcher-a");
    expect(sitemapText).not.toContain("fixture-private-project");
    expect(sitemapText).not.toContain("fixture-private-publication");
    expect(sitemapText).not.toContain("fixture-private-researcher");

    const feed = await request.get("/feed.xml");
    expect(feed.ok()).toBe(true);
    expect(await feed.text()).not.toContain("[Fixture] Private news");

    const search = await request.get("/api/search?q=Fixture");
    expect(search.ok()).toBe(true);
    const searchText = JSON.stringify(await search.json());
    expect(searchText).toContain("[Fixture] Public project");
    expect(searchText).toContain("[Fixture] Visibility testing");
    expect(searchText).toContain("Fixture Researcher A");
    expect(searchText).not.toContain("[Fixture] Private project");
    expect(searchText).not.toContain("[Fixture] Private publication");
    expect(searchText).not.toContain("Fixture Private Researcher");

    const graph = await request.get("/api/graph");
    expect(graph.ok()).toBe(true);
    const graphText = JSON.stringify(await graph.json());
    expect(graphText).not.toContain("[Fixture] Private project");
    expect(graphText).not.toContain("fixture-private-project");
    expect(graphText).not.toContain("[Fixture] Private publication");
    expect(graphText).not.toContain("fixture-private-publication");
    expect(graphText).not.toContain("Fixture Private Researcher");
    expect(graphText).not.toContain("fixture-private-researcher");

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "SANDHI in numbers" }),
    ).toHaveCount(0);
  });
});
