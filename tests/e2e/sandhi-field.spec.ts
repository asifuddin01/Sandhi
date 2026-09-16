import { expect, test } from "@playwright/test";

test("the home field keeps its poster while lazy WebGL settles without a custom cursor", async ({
  page,
}) => {
  await page.goto("/");

  const field = page.locator(".sandhi-field");
  const poster = field.locator(".sandhi-field-poster");
  await expect(poster).toBeVisible();
  await expect(field.locator("canvas")).toBeVisible({ timeout: 15_000 });
  await expect(field.locator(".sandhi-field-webgl")).toHaveAttribute(
    "data-particle-count",
    "1500",
  );
  await expect(field.locator(".sandhi-field-webgl")).toHaveAttribute(
    "data-sequence",
    /^(?:intro|settled)$/u,
  );
  await expect(field).toHaveCSS("cursor", "auto");
});

test("a settled visit skips the four-second entrance", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("sandhi-field-settled", "true");
  });
  await page.goto("/");

  await expect(page.locator(".sandhi-field-webgl")).toHaveAttribute(
    "data-sequence",
    "settled",
    { timeout: 15_000 },
  );
});

test("mobile uses the lower particle cap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".sandhi-field-webgl")).toHaveAttribute(
    "data-particle-count",
    "600",
    { timeout: 15_000 },
  );
});

test("reduced motion retains the complete poster and never mounts WebGL", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".sandhi-field-poster")).toBeVisible();
  await expect(page.locator(".sandhi-field-webgl")).toHaveCount(0);
  await expect(
    page.locator(".sandhi-field-poster__motion-traces"),
  ).toBeHidden();
  await expect(
    page.locator(".sandhi-field-poster__active-lines path").first(),
  ).toHaveCSS("animation-name", "none");
});

test.describe("the field without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the hero and its explanatory poster readable", async ({
    page,
  }) => {
    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { level: 1, name: "SANDHI Research Lab" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "The Sandhi Field Fine threads from two directions meet at a single junction.",
      }),
    ).toBeVisible();
    await expect(page.locator(".sandhi-field-webgl")).toHaveCount(0);
  });
});
