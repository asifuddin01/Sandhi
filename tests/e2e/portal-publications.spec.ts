import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/** All of these write publications that the others would otherwise read. */
test.describe.configure({ mode: "serial" });

const PREFIX = "[Fixture] Portal paper";

async function forgetPapers() {
  const db = createPrismaClient();
  try {
    await db.publication.deleteMany({
      where: { title: { startsWith: PREFIX } },
    });
  } finally {
    await db.$disconnect();
  }
}

test("a member records a paper, names its authors, and sends it to be read", async ({
  page,
}) => {
  test.slow();
  const title = `${PREFIX} ${Date.now()}`;

  try {
    await signIn(
      page,
      "fixture-member@sandhi.test",
      "/portal/publications/new",
    );

    await page.getByLabel("Title").fill(title);
    await page
      .getByLabel("Abstract")
      .fill("Fixture content used only by automated tests.");
    await page.getByLabel("What kind").selectOption("JOURNAL");
    await page.getByLabel("Venue", { exact: true }).fill("Fixture Journal");
    await page.getByLabel("Year").fill("2026");

    // A second author from outside the lab, to prove both kinds are kept.
    await page.getByRole("button", { name: "Add another author" }).click();
    await page.getByLabel("Name of author 2").fill("Outside Collaborator");
    await page.getByLabel("Affiliation of author 2").fill("Another University");
    await page.getByRole("button", { name: "Record it" }).click();

    await page.waitForURL(
      (url) =>
        /\/portal\/publications\/[^/]+$/u.test(url.pathname) &&
        !url.pathname.endsWith("/new"),
      { timeout: 30_000 },
    );
    const id = new URL(page.url()).pathname.split("/").pop()!;

    const db = createPrismaClient();
    try {
      const saved = await db.publication.findUniqueOrThrow({
        where: { id },
        select: {
          stage: true,
          state: true,
          authors: {
            orderBy: { position: "asc" },
            select: {
              externalName: true,
              corresponding: true,
              member: { select: { name: true } },
            },
          },
        },
      });
      // A member records a draft. It is not public, and publishing is not
      // theirs to do.
      expect(saved).toMatchObject({ stage: "DRAFT", state: "DRAFT" });
      expect(
        saved.authors.map(
          (author) => author.member?.name ?? author.externalName,
        ),
      ).toEqual(["Fixture Member", "Outside Collaborator"]);
      // Whoever records it is on the list, corresponding, without asking.
      expect(saved.authors[0]?.corresponding).toBe(true);
    } finally {
      await db.$disconnect();
    }

    // Sending it hands it over, and the page stops offering to change it.
    await page
      .getByRole("button", { name: "Send for internal review" })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText("Internal review", { exact: false }),
    ).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Send for internal review" }),
    ).toHaveCount(0);
    await expect(page.getByText(/with the lab now/u)).toBeVisible();

    const after = createPrismaClient();
    try {
      const moved = await after.publication.findUniqueOrThrow({
        where: { id },
        select: { stage: true, state: true },
      });
      // Handed over, but still not public: that stays the lab's decision.
      expect(moved).toMatchObject({
        stage: "INTERNAL_REVIEW",
        state: "DRAFT",
      });
    } finally {
      await after.$disconnect();
    }
  } finally {
    await forgetPapers();
  }
});

test("a paper you are not on is not yours to read or change", async ({
  page,
}) => {
  test.slow();
  const db = createPrismaClient();
  let id: string;

  try {
    // Somebody else's draft: authored by a member this account is not.
    const other = await db.member.findFirstOrThrow({
      where: { slug: "fixture-researcher-a" },
      select: { id: true },
    });
    const paper = await db.publication.create({
      data: {
        slug: `fixture-other-paper-${Date.now()}`,
        title: `${PREFIX} someone else's`,
        abstract: "Fixture content used only by automated tests.",
        type: "JOURNAL",
        stage: "DRAFT",
        state: "DRAFT",
        authors: { create: [{ position: 0, memberId: other.id }] },
      },
      select: { id: true },
    });
    id = paper.id;
    await db.$disconnect();

    await signIn(page, "fixture-member@sandhi.test", "/portal/publications");
    // Not in their list.
    await expect(page.getByText(`${PREFIX} someone else's`)).toHaveCount(0);

    // And the same answer as a paper that does not exist.
    expect(
      (await page.request.get(`/portal/publications/${id}`)).status(),
    ).toBe(404);
  } finally {
    await forgetPapers();
  }
});
