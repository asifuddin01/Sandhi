import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicCoreRoutes = [
  "/",
  "/about",
  "/research",
  "/projects",
  "/publications",
  "/people",
  "/news",
  "/contact",
  "/join",
  "/privacy",
  "/terms",
] as const;

for (const route of publicCoreRoutes) {
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
}

test.describe("public core without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const route of publicCoreRoutes) {
    test(`${route} keeps its reading content available`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.ok()).toBe(true);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("main#main-content")).toBeVisible();
    });
  }
});

test("the normal hero state contains a visibly animated thread trace", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const trace = page.locator(".sandhi-field-poster__motion-traces path").first();
  await expect(trace).toHaveCSS("animation-name", "sandhi-thread-flow");
  await expect(trace).toHaveCSS("display", "inline");
});

test("academic and industry collaboration do not request a CV", async ({
  page,
}) => {
  await page.goto("/join");

  await page.getByRole("radio", { name: /academic collaboration/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel(/CV \(PDF/i)).toHaveCount(0);
  await expect(page.getByText(/A CV is not required/i)).toBeVisible();
  await expect(page.getByLabel("Contact number")).toBeVisible();
});
