import { expect, test } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

/** These all write meetings the others would otherwise read. */
test.describe.configure({ mode: "serial" });

const PREFIX = "[Fixture] Meeting";

async function forgetMeetings() {
  const db = createPrismaClient();
  try {
    await db.meeting.deleteMany({ where: { title: { startsWith: PREFIX } } });
  } finally {
    await db.$disconnect();
  }
}

test("a lead calls a meeting, writes it up, and calls it off", async ({
  page,
}) => {
  test.slow();
  const title = `${PREFIX} ${Date.now()}`;

  try {
    await signIn(page, "fixture-member@sandhi.test", "/portal/meetings");

    await page.getByLabel("What the meeting is").fill(title);
    await page.getByLabel("Starts (Dhaka time)").fill("2026-12-01T15:00");
    await page.getByLabel("Agenda (optional)").fill("- One **point**");
    await page.getByRole("button", { name: "Call the meeting" }).click();
    await expect(page.getByText("Meeting called.")).toBeVisible();

    // It is in the diary, not merely in the database.
    const entry = page.getByRole("link", { name: title });
    await expect(entry).toBeVisible();
    await entry.click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    // The agenda is Markdown, and reaches the page as a list, not as source.
    await expect(
      page.getByRole("listitem").filter({ hasText: "point" }).first(),
    ).toBeVisible();
    await expect(page.getByText("Not written up yet.")).toBeVisible();

    await page
      .getByLabel("Write up what happened")
      .fill("## Decided\n\nAsif sends the licence.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Decided", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Not written up yet.")).toHaveCount(0);

    // The calendar file is the meeting, not a page about it.
    const ics = await page.request.get(`${page.url()}/ics`);
    expect(ics.status()).toBe(200);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    const body = await ics.text();
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("DTSTART:20261201T090000Z");
    expect(body).toContain(`SUMMARY:${PREFIX}`);

    // Calling it off leaves the page that was about it, rather than turning
    // that page into a 404 under the person who pressed the button.
    await page.getByRole("button", { name: "Call this meeting off" }).click();
    await page.waitForURL(/\/portal\/meetings$/u, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  } finally {
    await forgetMeetings();
  }
});

test("somebody who leads nothing is not offered the form", async ({ page }) => {
  // fixture-staff is on no project, so there is nothing they could call a
  // meeting about — and no administration rights to call a lab-wide one.
  // Not fixture-blank, whose empty profile is held at the profile rung and
  // never reaches this page at all.
  await signIn(page, "fixture-staff@sandhi.test", "/portal/meetings");
  await expect(page.getByRole("heading", { name: "Meetings" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Call a meeting" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Call the meeting" }),
  ).toHaveCount(0);
});

test("a meeting on a project you are not on cannot be reached", async ({
  page,
}) => {
  const db = createPrismaClient();
  let id = "";
  try {
    const project = await db.project.findFirst({
      where: { members: { none: { member: { slug: "fixture-staff" } } } },
      select: { id: true },
    });
    const meeting = await db.meeting.create({
      data: {
        title: `${PREFIX} private`,
        startsAt: new Date("2026-12-02T09:00:00.000Z"),
        projectId: project!.id,
      },
      select: { id: true },
    });
    id = meeting.id;
  } finally {
    await db.$disconnect();
  }

  try {
    await signIn(page, "fixture-staff@sandhi.test", "/portal/meetings");
    const page404 = await page.goto(`/portal/meetings/${id}`);
    expect(page404?.status()).toBe(404);

    // And the calendar file says no more than the page does.
    const ics = await page.request.get(`/portal/meetings/${id}/ics`);
    expect(ics.status()).toBe(404);
  } finally {
    await forgetMeetings();
  }
});
