import { expect, test, type Page } from "@playwright/test";

async function waitForScrollRestoration(page: Page) {
  await page.waitForFunction(
    () => typeof history.state?.__sandhiScrollEntry === "string",
  );
}

async function scrollInstantly(page: Page, requestedY: number) {
  return page.evaluate((y) => {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    const actualY = window.scrollY;
    root.style.scrollBehavior = previousBehavior;
    return actualY;
  }, requestedY);
}

async function expectScrollY(page: Page, expectedY: number) {
  await expect
    .poll(async () =>
      page.evaluate(
        (expected) => Math.abs(window.scrollY - expected),
        expectedY,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test("browser Back and Forward return to each page's exact scroll position", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { level: 1, name: "About SANDHI" }),
  ).toBeVisible();
  await waitForScrollRestoration(page);

  const aboutY = await scrollInstantly(page, 1_200);
  expect(aboutY).toBeGreaterThan(600);

  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Research", exact: true })
    .click();
  await expect(page).toHaveURL(/\/research$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Research" }),
  ).toBeVisible();

  const researchY = await scrollInstantly(page, 700);
  expect(researchY).toBeGreaterThan(300);

  await page.goBack();
  await expect(page).toHaveURL(/\/about$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "About SANDHI" }),
  ).toBeVisible();
  await expectScrollY(page, aboutY);

  await page.goForward();
  await expect(page).toHaveURL(/\/research$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Research" }),
  ).toBeVisible();
  await expectScrollY(page, researchY);
});

test("native hash anchors keep their own history behavior", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/privacy");
  await waitForScrollRestoration(page);

  const startingY = await scrollInstantly(page, 240);
  await page.evaluate(() => {
    window.location.hash = "privacy-files";
  });
  await expect(page).toHaveURL(/\/privacy#privacy-files$/u);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(startingY);
  await expect
    .poll(() =>
      page
        .locator("#privacy-files")
        .evaluate((heading) => heading.getBoundingClientRect().top),
    )
    .toBeLessThan(page.viewportSize()!.height / 2);

  await page.goBack();
  await expect(page).toHaveURL(/\/privacy$/u);
  await expectScrollY(page, startingY);
});
