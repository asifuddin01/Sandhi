import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/insights", "/open-science", "/partners"] as const;

for (const route of routes) {
  test(`${route} is readable without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(route);

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("main#main-content")).toBeVisible();
    await context.close();
  });

  test(`${route} has no detectable WCAG A/AA violations`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);

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
}

test("open science presents the six supplied commitments verbatim", async ({
  page,
}) => {
  await page.goto("/open-science");

  await expect(
    page.getByRole("main").getByRole("heading", { level: 2 }),
  ).toHaveCount(6);
  await expect(
    page.getByText(
      "We follow the data use agreements of every dataset we use and never release data we are not permitted to share.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("partners shows the required empty copy when no published records exist", async ({
  page,
}) => {
  await page.goto("/partners");

  const cards = page.locator(
    "a[class*='partner_'], article[class*='partner_']",
  );
  if ((await cards.count()) === 0) {
    await expect(
      page.getByText(
        "We welcome collaboration with universities, labs, and organizations. Get in touch through Join SANDHI.",
        { exact: true },
      ),
    ).toBeVisible();
  }
});
