import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("events has one page heading, excludes Internal, and passes WCAG A/AA checks", async ({
  page,
}) => {
  const response = await page.goto("/events");

  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { level: 1, name: "Events" }),
  ).toHaveCount(1);
  await expect(page.getByText("Internal", { exact: true })).toHaveCount(0);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
});

test.describe("events without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the events reading surface available", async ({ page }) => {
    const response = await page.goto("/events");

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { level: 1, name: "Events" }),
    ).toBeVisible();
    await expect(page.locator("main#main-content")).toBeVisible();
  });
});
