import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/opportunities", "/resources"] as const;

for (const route of routes) {
  test(`${route} has one page heading and no detectable WCAG A/AA violations`, async ({
    page,
  }) => {
    const response = await page.goto(route);

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(
      violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  });

  test(`${route} keeps its reading surface available without JavaScript`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(route);

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("main#main-content")).toBeVisible();
    await context.close();
  });
}

test("opportunities and resources use the specified empty states when no records are public", async ({
  page,
}) => {
  await page.goto("/opportunities");
  if ((await page.locator("article").count()) === 0) {
    await expect(
      page.getByText(
        "There are no open positions right now. You can still introduce yourself through Join SANDHI.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "Join SANDHI" }),
    ).toBeVisible();
  }

  await page.goto("/resources");
  if ((await page.locator("article").count()) === 0) {
    await expect(
      page.getByText(
        "Datasets, code, and models will be released here alongside our publications.",
        { exact: true },
      ),
    ).toBeVisible();
  }
});

test("the sitemap includes every remaining public index", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const sitemap = await response.text();

  for (const route of [
    "/events",
    "/opportunities",
    "/resources",
    "/insights",
    "/open-science",
    "/partners",
  ]) {
    expect(sitemap).toContain(`https://sandhiresearch.org${route}`);
  }
});
