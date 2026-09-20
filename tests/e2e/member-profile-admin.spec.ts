import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

const SLUG = "fixture-researcher-a";

/** Puts the fixture back exactly as the seed leaves it. */
async function restore() {
  const db = createPrismaClient();
  try {
    await db.member.update({
      where: { slug: SLUG },
      data: { rank: "RESEARCHER" },
    });
    await db.memberArea.updateMany({
      where: { member: { slug: SLUG } },
      data: { isLead: false },
    });
  } finally {
    await db.$disconnect();
  }
}

test("an administrator names a research lead from the person's own page", async ({
  page,
}) => {
  test.slow();
  try {
    await signIn(page, "fixture-admin@sandhi.test", `/people/${SLUG}`);

    const bar = page.getByRole("complementary", {
      name: "Manage Fixture Researcher A",
    });
    await expect(bar).toBeVisible();

    // Naming a research lead needs no trip to administration.
    await bar.getByLabel("Standing").selectOption("RESEARCH_LEAD");
    const [response] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.request().method() === "POST" &&
          new URL(candidate.url()).pathname === `/people/${SLUG}`,
        { timeout: 30_000 },
      ),
      bar.getByRole("button", { name: "Save standing" }).click(),
    ]);
    expect(response.status()).toBeLessThan(400);
    await expect(
      page.getByText("Fixture Researcher A is now Research Lead."),
    ).toBeVisible();

    // And it is what the public page says afterwards.
    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { level: 1 }).locator("xpath=following::p[1]"),
    ).toHaveText("Research Lead");

    // Leading a research area is set on the same page.
    await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.request().method() === "POST" &&
          new URL(candidate.url()).pathname === `/people/${SLUG}`,
        { timeout: 30_000 },
      ),
      bar.getByRole("button", { name: "Make lead" }).first().click(),
    ]);
    await expect(page.getByText(/leading it/u)).toBeVisible();
  } finally {
    await restore();
  }
});

test("nobody else is offered those controls, or told they exist", async ({
  page,
}) => {
  // A visitor with no account.
  await page.goto(`/people/${SLUG}`);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save standing" })).toHaveCount(
    0,
  );

  // And a signed-in member, who is not an administrator.
  await signIn(page, "fixture-member@sandhi.test", `/people/${SLUG}`);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save standing" })).toHaveCount(
    0,
  );
});
