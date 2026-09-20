import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/**
 * These read and write the same two fixture applications, so they take turns
 * rather than reading each other's rows.
 */
test.describe.configure({ mode: "serial" });

const ACCEPTED = "fixture-accepted@example.org";
const NEW_ONE = "fixture-applicant@example.org";

async function idOf(email: string): Promise<string> {
  const db = createPrismaClient();
  try {
    const row = await db.application.findFirstOrThrow({
      where: { email },
      select: { id: true },
    });
    return row.id;
  } finally {
    await db.$disconnect();
  }
}

/** Puts the fixtures back the way `pnpm seed:fixtures` leaves them. */
async function restore() {
  const db = createPrismaClient();
  try {
    await db.applicationNote.deleteMany({
      where: { application: { email: { in: [ACCEPTED, NEW_ONE] } } },
    });
    await db.invitation.deleteMany({ where: { email: ACCEPTED } });
    await db.application.updateMany({
      where: { email: ACCEPTED },
      data: { status: "ACCEPTED", rating: null },
    });
    await db.application.updateMany({
      where: { email: NEW_ONE },
      data: { status: "NEW", rating: null },
    });
    await db.auditLog.deleteMany({
      where: { action: { startsWith: "application." } },
    });
  } finally {
    await db.$disconnect();
  }
}

test("an administrator reads the queue, moves one along, and notes why", async ({
  page,
}) => {
  test.slow();
  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/applications");

    // The queue says how much is outstanding, not just how much exists.
    await expect(
      page.getByRole("heading", { name: "Applications" }),
    ).toBeVisible();
    await expect(page.getByText(/still waiting on an answer/u)).toBeVisible();

    await page.getByRole("link", { name: "Fixture Applicant" }).click();
    await expect(
      page.getByRole("heading", { name: "Fixture Applicant" }),
    ).toBeVisible();
    // What they wrote is shown as they wrote it.
    await expect(page.getByText(/boundary detection in speech/u)).toBeVisible();

    await page.getByLabel("State").selectOption("SHORTLISTED");
    await page.getByRole("button", { name: "Set state" }).click();
    await expect(page.getByText("Moved to Shortlisted.")).toBeVisible();

    await page.getByLabel("Rating").selectOption("4");
    await page.getByRole("button", { name: "Save rating" }).click();
    await expect(page.getByText("Rated 4.")).toBeVisible();

    await page.getByLabel("Add a note").fill("Strong on the speech side.");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Note added.")).toBeVisible();
    await expect(page.getByText("Strong on the speech side.")).toBeVisible();

    // The change is on the record, with who made it.
    const db = createPrismaClient();
    try {
      const audits = await db.auditLog.findMany({
        where: { action: { startsWith: "application." } },
        select: { action: true },
      });
      expect(audits.map((entry) => entry.action).sort()).toEqual([
        "application.note",
        "application.rating",
        "application.status",
      ]);
    } finally {
      await db.$disconnect();
    }

    // And the queue reflects it.
    await page.goto("/admin/applications?status=SHORTLISTED");
    await expect(
      page.getByRole("link", { name: "Fixture Applicant" }),
    ).toBeVisible();
  } finally {
    await restore();
  }
});

test("accepting is what offers an invitation, and sending it says so", async ({
  page,
}) => {
  test.slow();
  try {
    const decided = await idOf(ACCEPTED);
    const undecided = await idOf(NEW_ONE);
    await signIn(
      page,
      "fixture-admin@sandhi.test",
      `/admin/applications/${undecided}`,
    );

    // Nothing to send while the lab has not decided.
    await expect(
      page.getByText("Accepting this application offers an invitation here."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send invitation" }),
    ).toHaveCount(0);

    await page.goto(`/admin/applications/${decided}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Joining as").selectOption("INTERN");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText(/Invitation sent to/u)).toBeVisible({
      timeout: 30_000,
    });

    // An invitation really exists, for that address and that standing, and
    // the application now says so itself.
    const db = createPrismaClient();
    try {
      const invitation = await db.invitation.findFirstOrThrow({
        where: { email: ACCEPTED, acceptedAt: null, revokedAt: null },
        select: { rank: true, role: true },
      });
      expect(invitation).toMatchObject({
        rank: "INTERN",
        role: "MEMBER",
      });
      const application = await db.application.findFirstOrThrow({
        where: { email: ACCEPTED },
        select: { status: true },
      });
      expect(application.status).toBe("INVITED");
    } finally {
      await db.$disconnect();
    }

    // The outcome survives the page rewriting itself, which is the only way
    // a failed email would ever be reported.
    await expect(page.getByText(/Invitation sent to/u)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send invitation" }),
    ).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByText(/An invitation has been sent to Fixture Accepted/u),
    ).toBeVisible();
  } finally {
    await restore();
  }
});

test("nobody without the capability reaches applications at all", async ({
  page,
}) => {
  test.slow();
  const id = await idOf(NEW_ONE);

  // A reviewer holds `admin:access` but not `applications:manage`.
  await signIn(page, "fixture-reviewer@sandhi.test", "/admin");
  await expect(page.getByRole("link", { name: "Applications" })).toHaveCount(0);
  expect((await page.request.get("/admin/applications")).status()).toBe(404);
  expect((await page.request.get(`/admin/applications/${id}`)).status()).toBe(
    404,
  );
  // The files say nothing either — the same answer as an application that
  // does not exist.
  expect(
    (await page.request.get(`/files/applications/${id}/cv`)).status(),
  ).toBe(404);

  // And a signed-out visitor is sent to sign in rather than shown anything.
  await page.context().clearCookies();
  await page.goto("/admin/applications");
  await expect(page).toHaveURL(/\/portal\/sign-in/u, { timeout: 30_000 });
});
