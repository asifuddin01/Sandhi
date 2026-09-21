import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/** Both tests publish and edit the same member's profile. */
test.describe.configure({ mode: "serial" });

const MEMBER = "fixture-member@sandhi.test";
const BIO =
  "Fixture content used only by automated tests. This paragraph exists so the portal counts the profile as written.";

async function memberId(): Promise<string> {
  const db = createPrismaClient();
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email: MEMBER } });
    const member = await db.member.findUniqueOrThrow({
      where: { userId: user.id },
      select: { id: true },
    });
    return member.id;
  } finally {
    await db.$disconnect();
  }
}

/** Publishes the profile, so its changes are the kind that wait. */
async function publish(isPublic: boolean) {
  const db = createPrismaClient();
  try {
    const id = await memberId();
    await db.changeRequest.deleteMany({ where: { memberId: id } });
    await db.member.update({
      where: { id },
      data: {
        isPublic,
        bio: BIO,
        title: null,
        interests: ["Fixture interest"],
      },
    });
  } finally {
    await db.$disconnect();
  }
}

async function restore() {
  await publish(false);
  const db = createPrismaClient();
  try {
    // "member.profile" as well as "member.profile_*": saving a profile
    // directly audits under the shorter name, and a stray row here fails the
    // escalation test in admin-members, which counts every non-auth entry
    // for this account.
    await db.auditLog.deleteMany({
      where: { action: { startsWith: "member.profile" } },
    });
  } finally {
    await db.$disconnect();
  }
}

test("a member's change to a published profile waits, and the site shows the old one", async ({
  page,
  browser,
}) => {
  test.slow();
  try {
    await publish(true);
    await signIn(page, MEMBER, "/portal/profile");

    await page.getByLabel("Your role").fill("Doctoral researcher");
    await page.getByRole("button", { name: "Save my profile" }).click();
    // The form says so, and so does the page: the same words in both, which
    // is why this is scoped rather than matched loosely.
    await expect(
      page
        .getByRole("region", { name: "About you" })
        .getByText("Your changes are waiting for approval."),
    ).toBeVisible({ timeout: 30_000 });

    // The public page is untouched while it waits.
    const slug = "fixture-member";
    const publicPage = await (await page.request.get(`/people/${slug}`)).text();
    expect(publicPage).not.toContain("Doctoral researcher");

    // And the member is told, on their own page, what is outstanding.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("Your changes are waiting for approval."),
    ).toBeVisible();
    // Only the page's own banner now; the form's message went with the load.
    await expect(
      page.getByText("Your changes are waiting for approval."),
    ).toHaveCount(1);
    await expect(page.getByText(/Role: Doctoral researcher/u)).toBeVisible();

    // An administrator sees it as a before and after, and allows it.
    const admin = await browser.newContext();
    const theirs = await admin.newPage();
    await signIn(theirs, "fixture-admin@sandhi.test", "/admin/approvals");
    const block = theirs.getByRole("region", {
      name: "Fixture Member's profile",
    });
    await expect(block).toContainText("Role");
    await expect(block).toContainText("— nothing —");
    await expect(block).toContainText("Doctoral researcher");
    await block
      .getByRole("button", { name: /Approve Fixture Member/u })
      .click();
    // Approving empties the queue, so the form that carried the message is
    // gone. What was decided is stated in its own right instead.
    await expect(
      theirs.getByRole("region", { name: "Decided in the last day" }),
    ).toContainText("Fixture Member", { timeout: 30_000 });
    await expect(
      theirs.getByRole("region", { name: "Decided in the last day" }),
    ).toContainText("applied");
    await admin.close();

    // Now, and only now, the public page says it.
    const after = await (await page.request.get(`/people/${slug}`)).text();
    expect(after).toContain("Doctoral researcher");

    const db = createPrismaClient();
    try {
      const audits = await db.auditLog.findMany({
        where: { action: { startsWith: "member.profile_" } },
        select: { action: true },
      });
      expect(audits.map((entry) => entry.action).sort()).toEqual([
        "member.profile_approved",
        "member.profile_requested",
      ]);
    } finally {
      await db.$disconnect();
    }
  } finally {
    await restore();
  }
});

test("a profile that is not published is edited directly", async ({ page }) => {
  test.slow();
  try {
    await publish(false);
    await signIn(page, MEMBER, "/portal/profile");

    await page.getByLabel("Your role").fill("Research assistant");
    await page.getByRole("button", { name: "Save my profile" }).click();
    await expect(page.getByText("Your profile is saved.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText("Your changes are waiting for approval."),
    ).toHaveCount(0);

    const db = createPrismaClient();
    try {
      const member = await db.member.findUniqueOrThrow({
        where: { id: await memberId() },
        select: { title: true },
      });
      // Written through: there is nothing public to protect yet, and a new
      // member must not be held at the completion gate waiting for somebody
      // to approve their own name.
      expect(member.title).toBe("Research assistant");
      expect(
        await db.changeRequest.count({ where: { status: "PENDING" } }),
      ).toBe(0);
    } finally {
      await db.$disconnect();
    }
  } finally {
    await restore();
  }
});
