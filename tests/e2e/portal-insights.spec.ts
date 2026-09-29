import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/** These all write notes the others would otherwise read. */
test.describe.configure({ mode: "serial" });

const PREFIX = "[Fixture] Note";

async function forgetNotes() {
  const db = createPrismaClient();
  try {
    await db.insight.deleteMany({ where: { title: { startsWith: PREFIX } } });
    await db.auditLog.deleteMany({
      where: { action: "insight.state_changed" },
    });
  } finally {
    await db.$disconnect();
  }
}

test("a note is written, handed over, and published by a reviewer", async ({
  page,
}) => {
  test.slow();
  const title = `${PREFIX} ${Date.now()}`;

  try {
    await signIn(page, "fixture-member@sandhi.test", "/portal/insights/new");

    await page.getByLabel("Title", { exact: true }).fill(title);
    await page
      .getByLabel("Summary", { exact: true })
      .fill("What the alignment run told us about the 1913 hand.");
    await page
      .getByLabel("The note", { exact: true })
      .fill("## Finding\n\nThe **noisier** hand needs smaller batches.");

    // The preview is rendered by the server, by the same component the
    // public page uses — so a heading arrives as a heading.
    const preview = page.getByRole("region", { name: "The note preview" });
    await expect(preview.getByRole("heading", { name: "Finding" })).toBeVisible(
      { timeout: 30_000 },
    );

    await page.getByRole("button", { name: "Start the draft" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(
      page.getByText("A draft. Yours to change until you send it."),
    ).toBeVisible();

    // Handing it over closes the draft to its author.
    await page.getByRole("button", { name: "Send it to be read" }).click();
    await expect(page.getByText("With the reviewers")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save the draft" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Send it to be read" }),
    ).toHaveCount(0);
  } finally {
    // Left in review on purpose: the next test picks it up.
  }

  // A reviewer reads it and puts it out.
  await signIn(page, "fixture-reviewer@sandhi.test", "/admin/insights");
  const waiting = page.getByRole("region", { name: title });
  await expect(waiting).toBeVisible();
  await waiting
    .getByRole("button", { name: "Publish it", exact: true })
    .click();
  // Publishing moves the note out of this list, so the button that did it is
  // gone along with its message. The page keeps a record in its place.
  const decided = page.getByRole("region", { name: "Decided in the last day" });
  await expect(decided.getByText(title)).toBeVisible();
  await expect(decided.getByText("published")).toBeVisible();

  // And the author sees where it got to, without being able to change it.
  await signIn(page, "fixture-member@sandhi.test", "/portal/insights");
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByText("Published on the public site.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read it on the public site" }),
  ).toBeVisible();

  await forgetNotes();
});

test("a note a reviewer sends back becomes the author's again", async ({
  page,
}) => {
  test.slow();
  const title = `${PREFIX} returned ${Date.now()}`;

  const db = createPrismaClient();
  try {
    const member = await db.member.findUnique({
      where: { slug: "fixture-member" },
      select: { id: true },
    });
    await db.insight.create({
      data: {
        slug: `fixture-note-returned-${Date.now()}`,
        title,
        summary: "A note waiting to be read.",
        body: "Something worth saying.",
        kind: "FINDING",
        state: "IN_REVIEW",
        authors: { create: [{ memberId: member!.id, position: 0 }] },
      },
    });
  } finally {
    await db.$disconnect();
  }

  try {
    await signIn(page, "fixture-reviewer@sandhi.test", "/admin/insights");
    await page
      .getByRole("region", { name: title })
      .getByRole("button", { name: "Send it back" })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Decided in the last day" })
        .getByText("sent back to its author"),
    ).toBeVisible();

    await signIn(page, "fixture-member@sandhi.test", "/portal/insights");
    await page.getByRole("link", { name: title }).click();
    await expect(
      page.getByText("A draft. Yours to change until you send it."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save the draft" }),
    ).toBeVisible();
  } finally {
    await forgetNotes();
  }
});

test("a member cannot reach another member's note, or the review queue", async ({
  page,
}) => {
  const db = createPrismaClient();
  let id = "";
  try {
    const other = await db.member.findFirst({
      where: { slug: { not: "fixture-staff" }, userId: { not: null } },
      select: { id: true },
    });
    const note = await db.insight.create({
      data: {
        slug: `fixture-note-private-${Date.now()}`,
        title: `${PREFIX} private`,
        summary: "Not theirs.",
        body: "Not theirs.",
        kind: "FINDING",
        state: "DRAFT",
        authors: { create: [{ memberId: other!.id, position: 0 }] },
      },
      select: { id: true },
    });
    id = note.id;
  } finally {
    await db.$disconnect();
  }

  try {
    await signIn(page, "fixture-staff@sandhi.test", "/portal/insights");
    const note = await page.goto(`/portal/insights/${id}`);
    expect(note?.status()).toBe(404);

    // The review queue is staff work, and a member is not staff.
    const queue = await page.goto("/admin/insights");
    expect(queue?.status()).toBe(404);
  } finally {
    await forgetNotes();
  }
});
