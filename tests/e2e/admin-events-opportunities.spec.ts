import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";
import { toDhakaInput } from "../../lib/dhaka-time";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

const DAY = 24 * 60 * 60 * 1000;

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, nodes: nodes.length })),
  ).toEqual([]);
}

test("staff run events, and registrants stay private to administrators", async ({
  browser,
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const slug = `fixture-event-${stamp}`;
  const title = `Fixture event ${stamp}`;
  const db = createPrismaClient();

  try {
    await signIn(page, "fixture-admin@sandhi.test", "/admin/events/new");
    await expectNoViolations(page);
    await page.getByLabel("Title").fill(title);
    await expect(page.getByLabel("Address")).toHaveValue(slug);
    await page
      .getByLabel("Description", { exact: true })
      .fill("A seminar on **sparse attention**.");
    await page
      .getByLabel("Starts (Dhaka)")
      .fill(toDhakaInput(new Date(Date.now() + 7 * DAY)));
    await page
      .getByLabel("Ends (Dhaka)")
      .fill(toDhakaInput(new Date(Date.now() + 6 * DAY)));
    await page.getByLabel("Speakers").fill("Ada Lovelace\nGrace Hopper");
    await page
      .getByLabel("Or an external registration link")
      .fill("http://insecure.example");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText(/must end after it starts/u)).toBeVisible();

    await page
      .getByLabel("Ends (Dhaka)")
      .fill(toDhakaInput(new Date(Date.now() + 7 * DAY + 60 * 60 * 1000)));
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(
      page.getByText(/needs a full https:\/\/ address/u),
    ).toBeVisible();

    await page.getByLabel("Or an external registration link").fill("");
    await page.getByLabel("Let people register on this site").check();
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });
    const id = new URL(page.url()).pathname.split("/").pop()!;
    expect((await request.get(`/events/${slug}`)).status()).toBe(404);

    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByText(/not public yet/u)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(
      page.getByText("Registration opens here once the event is published."),
    ).toBeVisible();

    await page.goto(`/admin/events/${id}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("State").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    const live = await request.get(`/events/${slug}`);
    expect(live.status()).toBe(200);
    expect(await live.text()).toContain("Grace Hopper");

    // Someone registers; administrators see who, reviewers only a count.
    await db.eventRegistration.create({
      data: {
        eventId: id,
        name: "Fixture Registrant",
        email: `registrant-${stamp}@sandhi.test`,
      },
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Registrations (1)" }),
    ).toBeVisible();
    await expect(page.getByText("Fixture Registrant")).toBeVisible();
    const reviewer = await browser.newPage();
    try {
      await signIn(
        reviewer,
        "fixture-reviewer@sandhi.test",
        `/admin/events/${id}`,
      );
      await expect(
        reviewer.getByText("Only administrators can see who registered."),
      ).toBeVisible();
      await expect(reviewer.getByText("Fixture Registrant")).toHaveCount(0);
    } finally {
      await reviewer.context().close();
    }

    // Archived, it leaves the site; registrations keep it from deletion.
    await page.goto(`/admin/events?q=${slug}`);
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
    await page.getByLabel(`Select ${title}`).check();
    await page.getByLabel("With selected events").selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    expect((await request.get(`/events/${slug}`)).status()).toBe(404);
    await page.getByLabel(`Select ${title}`).check();
    await page.getByLabel("With selected events").selectOption("delete");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText(/0 deleted\. 1 kept \(people have registered/u),
    ).toBeVisible();
    expect(await db.event.count({ where: { id } })).toBe(1);
  } finally {
    const events = await db.event.findMany({
      where: { slug: { startsWith: slug } },
      select: { id: true },
    });
    await db.auditLog.deleteMany({
      where: { entityId: { in: events.map(({ id }) => id) } },
    });
    await db.event.deleteMany({ where: { slug: { startsWith: slug } } });
    await db.$disconnect();
  }
});

test("administrators run opportunities, which close on their own", async ({
  browser,
  page,
  request,
}) => {
  test.slow();
  const stamp = Date.now();
  const slug = `fixture-opportunity-${stamp}`;
  const title = `Fixture opportunity ${stamp}`;
  const db = createPrismaClient();

  try {
    // Opportunities are an administrator's decision, not a reviewer's.
    const reviewer = await browser.newPage();
    try {
      await signIn(reviewer, "fixture-reviewer@sandhi.test", "/admin");
      expect(
        (await reviewer.request.get("/admin/opportunities")).status(),
      ).toBe(404);
    } finally {
      await reviewer.context().close();
    }

    await signIn(page, "fixture-admin@sandhi.test", "/admin/opportunities/new");
    await expectNoViolations(page);
    await page.getByLabel("Title").fill(title);
    await page
      .getByLabel("Description", { exact: true })
      .fill("Join us to study **efficient inference**.");
    await page
      .getByLabel("Responsibilities")
      .fill("Run experiments\nWrite up results");
    await page.getByLabel("Requirements").fill("Python\nCuriosity");
    await page.getByLabel("Language Models & NLP").check();
    await page
      .getByLabel("Deadline (Dhaka)")
      .fill(toDhakaInput(new Date(Date.now() + 14 * DAY)));
    await page.getByLabel("State").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create opportunity" }).click();
    await expect(page).toHaveURL(/\/admin\/opportunities\/[^/]+\?created=1$/u, {
      timeout: 30_000,
    });
    const id = new URL(page.url()).pathname.split("/").pop()!;

    const open = await request.get(`/opportunities/${slug}`);
    expect(open.status()).toBe(200);
    expect(await open.text()).toContain("Write up results");
    const saved = await db.opportunity.findUniqueOrThrow({ where: { id } });
    expect(saved.areaSlugs).toEqual(["language-models-and-nlp"]);

    // Once the deadline passes, it is closed without anyone acting.
    await db.opportunity.update({
      where: { id },
      data: { deadline: new Date(Date.now() - 60 * 1000) },
    });
    expect((await request.get(`/opportunities/${slug}`)).status()).toBe(404);
    await page.goto(`/admin/opportunities?q=${slug}`);
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("row").filter({ hasText: title }).getByText("Closed"),
    ).toBeVisible();

    // An application keeps the opening from being deleted.
    await db.application.create({
      data: {
        type: "RESEARCHER",
        name: "Fixture Applicant",
        email: `applicant-${stamp}@sandhi.test`,
        institution: "Fixture University",
        currentRole: "Student",
        motivation: "Testing.",
        consent: true,
        opportunityId: id,
      },
    });
    await page.getByLabel(`Select ${title}`).check();
    await page
      .getByLabel("With selected opportunities")
      .selectOption("archive");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("1 archived.")).toBeVisible();
    await page.getByLabel(`Select ${title}`).check();
    await page.getByLabel("With selected opportunities").selectOption("delete");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(/people have applied/u)).toBeVisible();
    expect(await db.opportunity.count({ where: { id } })).toBe(1);
  } finally {
    const opportunities = await db.opportunity.findMany({
      where: { slug },
      select: { id: true },
    });
    const ids = opportunities.map(({ id }) => id);
    await db.application.deleteMany({ where: { opportunityId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.opportunity.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
