import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

async function completeJoinAboutStep(page: Page, includeCv = false) {
  await page.getByLabel("Full name *", { exact: true }).fill("Ada Applicant");
  await page.getByLabel("Email *", { exact: true }).fill("ada@example.org");
  await page
    .getByLabel("Institution or organization *", { exact: true })
    .fill("Example University");
  await page.getByLabel("Current role *", { exact: true }).fill("Researcher");
  await page.getByLabel("Computer Vision", { exact: true }).check();

  if (includeCv) {
    await page.getByLabel("CV (PDF, max 5 MB) *").setInputFiles({
      name: "cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fixture"),
    });
  }
}

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

  const trace = page
    .locator(".sandhi-field-poster__motion-traces path")
    .first();
  await expect(trace).toHaveCSS("animation-name", "sandhi-thread-flow");
  await expect(trace).toHaveCSS("display", "inline");
});

test("academic and industry collaboration show only the next-step brief note", async ({
  page,
}) => {
  const note =
    "In the next step, describe the collaboration and optionally attach a PDF brief.";

  for (const path of [/academic collaboration/i, /industry collaboration/i]) {
    // Reopening the current URL behaves like a reload and keeps the step.
    await page.goto("/about");
    await page.goto("/join");
    await page.getByRole("radio", { name: path }).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByLabel(/CV \(/i)).toHaveCount(0);
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await expect(page.getByText(/A CV is not required/i)).toHaveCount(0);
    await expect(page.getByLabel("Contact number")).toBeVisible();
  }
});

test("project applications identify their path and require a proposal PDF", async ({
  page,
}) => {
  await page.goto("/join");
  await page.getByRole("radio", { name: /propose a project/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByText("You’re completing the Propose a project application.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("CV (optional PDF, max 5 MB)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "In the next step, describe the project and attach the required proposal PDF.",
      { exact: true },
    ),
  ).toBeVisible();

  await completeJoinAboutStep(page);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByText("You’re completing the Propose a project application.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Full proposal (PDF, max 10 MB) *", { exact: true }),
  ).toHaveAttribute("required", "");
});

test("browser Back and Forward move through Join steps before leaving the page", async ({
  page,
}) => {
  const interest = page.getByRole("group", {
    name: "What would you like to do?",
  });
  const about = page.getByRole("group", { name: "About you" });
  const motivation = page.getByRole("group", { name: "Your motivation" });

  await page.goto("/about");
  await page.goto("/join");
  await page.getByRole("radio", { name: /join as a researcher/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(about).toBeVisible();

  await completeJoinAboutStep(page, true);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(motivation).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/join$/u);
  await expect(about).toBeVisible();
  await expect(page.getByLabel("Full name *", { exact: true })).toHaveValue(
    "Ada Applicant",
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/join$/u);
  await expect(interest).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /join as a researcher/i }),
  ).toBeChecked();

  await page.goForward();
  await expect(about).toBeVisible();
  await page.goForward();
  await expect(motivation).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(about).toBeVisible();
  await page.goBack();
  await expect(interest).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/u);
});

test("a reload on the last Join step explains that the CV must be attached again", async ({
  page,
}) => {
  await page.goto("/join");
  await page.getByRole("radio", { name: /join as a researcher/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await completeJoinAboutStep(page, true);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("group", { name: "Your motivation" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("group", { name: "Your motivation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(
    page.getByText(
      "Files are not kept when the page reloads. Go back to About you and attach your CV again.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("a chosen PDF can be removed and stays listed when returning to its step", async ({
  page,
}) => {
  await page.goto("/join");
  await page.getByRole("radio", { name: /join as a researcher/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("CV (PDF, max 5 MB) *").setInputFiles({
    name: "Ada_Applicant_CV.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fixture"),
  });
  const chosen = page.getByRole("group", { name: "CV (PDF, max 5 MB) *" });
  await expect(chosen).toContainText("Ada_Applicant_CV.pdf");
  await expect(chosen).toContainText("1 KB");

  await chosen
    .getByRole("button", { name: "Remove Ada_Applicant_CV.pdf" })
    .click();
  await expect(chosen).toHaveCount(0);
  const picker = page.getByLabel("CV (PDF, max 5 MB) *");
  await expect(picker).toBeFocused();
  await expect(picker).toHaveAttribute("required", "");

  await completeJoinAboutStep(page, true);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("group", { name: "Your motivation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(
    page.getByRole("group", { name: "CV (PDF, max 5 MB) *" }),
  ).toContainText("cv.pdf");
});

test("research collaboration keeps its proposal attachment optional", async ({
  page,
}) => {
  await page.goto("/join");
  await page.getByRole("radio", { name: /research collaboration/i }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await completeJoinAboutStep(page, true);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByText(
      "You’re completing the Research collaboration application.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Collaboration brief (optional PDF, max 10 MB)", {
      exact: true,
    }),
  ).not.toHaveAttribute("required", "");
});
