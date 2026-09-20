import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

const PREFIX = "Fixture proposal";

async function forgetProposals() {
  const db = createPrismaClient();
  try {
    const proposals = await db.proposal.findMany({
      where: { title: { startsWith: PREFIX } },
      select: { projectId: true },
    });
    await db.proposal.deleteMany({ where: { title: { startsWith: PREFIX } } });
    const projectIds = proposals
      .map((row) => row.projectId)
      .filter((id): id is string => Boolean(id));
    if (projectIds.length > 0) {
      await db.project.deleteMany({ where: { id: { in: projectIds } } });
    }
  } finally {
    await db.$disconnect();
  }
}

/** A server action answers the POST that carried it. */
async function submit(page: Page, name: string, path: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        new URL(candidate.url()).pathname === path,
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name, exact: true }).click(),
  ]);
  expect(response.status()).toBeLessThan(400);
}

test("/proposals has one page heading and no detectable WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/proposals");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("an idea from outside the lab becomes a project with the people who volunteered", async ({
  page,
}) => {
  test.slow();
  const title = `${PREFIX} ${Date.now()}`;

  try {
    // Anyone may send one in: no account, no invitation.
    await page.goto("/proposals");
    // The form is controlled, so React must have taken over before anything
    // is typed: values set during hydration are thrown away.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Title *").fill(title);
    await page
      .getByLabel("In a paragraph *")
      .fill(
        "Boundary detection leans on lexical cues and stalls on discourse markers. We think prosody carries most of the signal.",
      );
    await page
      .getByLabel("What it would ask *")
      .fill("How much of the boundary signal is prosodic rather than lexical?");
    await page.getByLabel("Your name *").fill("Outside Colleague");
    await page.getByLabel("Your email *").fill("outside@example.org");
    await page.getByRole("button", { name: "Send proposal" }).click();
    await expect(page.getByText("Proposal received.")).toBeVisible();

    // A member cannot see it: an idea under review is not an invitation.
    await signIn(page, "fixture-member@sandhi.test", "/portal/proposals");
    await expect(page.getByText(title)).toHaveCount(0);

    // A reviewer queues it, and it reaches the lab.
    const admin = await page.context().browser()?.newContext();
    if (!admin) throw new Error("No browser context.");
    const theirs = await admin.newPage();
    let proposalPath = "";
    try {
      await signIn(theirs, "fixture-admin@sandhi.test", "/admin/proposals");
      await theirs.getByRole("link", { name: title }).click();
      await theirs.waitForURL(/\/admin\/proposals\/[^/]+$/u, {
        timeout: 30_000,
      });
      proposalPath = new URL(theirs.url()).pathname;
      await expect(theirs.getByRole("heading", { level: 1 })).toHaveText(title);
      // The address is on the record for whoever picks it up.
      await expect(theirs.getByText("outside@example.org")).toBeVisible();

      await theirs
        .getByLabel("Why (kept on the record)")
        .first()
        .fill("Worth doing. Needs someone who knows prosody.");
      await submit(theirs, "Queue it for the lab", proposalPath);
      await expect(theirs.getByText("Queued.")).toBeVisible();
    } finally {
      // The member says they are in.
      await page.goto("/portal/proposals");
      const card = page.getByRole("listitem").filter({ hasText: title });
      await expect(card).toBeVisible();
      await card.getByLabel("What you would bring (optional)").fill("Prosody");
      await submit(page, "I would work on this", "/portal/proposals");
      await expect(page.getByText("You are in on")).toBeVisible();
    }

    // The administrator approves, and the volunteers are the team.
    await theirs.goto(proposalPath);
    // The name is also an option in the lead picker, so scope to the list.
    await expect(
      theirs.getByRole("region", { name: "Who is in" }),
    ).toContainText("Fixture Member");
    await expect(
      theirs.getByRole("region", { name: "Who is in" }),
    ).toContainText("Prosody");
    await theirs.getByLabel("Research Lead").selectOption({
      label: "Fixture Member",
    });
    await submit(theirs, "Approve and make it a project", proposalPath);
    // Once it is approved the form is gone, and so is its message: the
    // state of the proposal is what says it worked.
    await expect(
      theirs.getByText("Approved and running as a project."),
    ).toBeVisible();
    await expect(
      theirs.getByRole("button", { name: "Approve and make it a project" }),
    ).toHaveCount(0);
    await admin.close();

    // It is now the member's project, and they lead it.
    await page.goto("/portal/projects");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByText("Research Lead")).toBeVisible();
  } finally {
    await forgetProposals();
  }
});

test("a member cannot reach the review queue, and is not told it exists", async ({
  page,
}) => {
  await signIn(page, "fixture-member@sandhi.test", "/portal");
  const response = await page.goto("/admin/proposals");
  expect(response?.status()).toBe(404);
});
