import { expect, test, type Page } from "@playwright/test";

import type { Prisma } from "../../generated/prisma/client";
import { createPrismaClient } from "../../lib/db-runtime";

import { signIn as signInAs } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

// Settings are global, so these tests must not overlap.
test.describe.configure({ mode: "serial" });

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function signIn(page: Page, email: string, next: string) {
  await signInAs(page, email, next);
}

type StoredSetting = { key: string; value: Prisma.JsonValue };

/** Puts every setting back exactly as it was before the test. */
async function restoreSettings(saved: StoredSetting[], since: Date) {
  const db = createPrismaClient();
  try {
    await db.$transaction([
      db.siteSetting.deleteMany({}),
      db.siteSetting.createMany({
        data: saved.map(({ key, value }) => ({
          key,
          value: value as Prisma.InputJsonValue,
        })),
      }),
      db.auditLog.deleteMany({
        where: { action: "settings.update", createdAt: { gte: since } },
      }),
    ]);
  } finally {
    await db.$disconnect();
  }
}

/** A public event that exists only for the length of one test. */
async function withTemporaryEvent(run: (path: string) => Promise<void>) {
  const slug = `fixture-settings-event-${Date.now()}`;
  const db = createPrismaClient();
  try {
    await db.event.create({
      data: {
        slug,
        title: "Fixture settings event",
        kind: "SEMINAR",
        abstract: "Temporary event for the settings test.",
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        state: "PUBLISHED",
      },
    });
    await run(`/events/${slug}`);
  } finally {
    await db.event.deleteMany({ where: { slug } });
    await db.$disconnect();
  }
}

async function snapshotSettings(): Promise<StoredSetting[]> {
  const db = createPrismaClient();
  try {
    return await db.siteSetting.findMany({
      select: { key: true, value: true },
    });
  } finally {
    await db.$disconnect();
  }
}

test("an administrator's settings change the public site and are audited", async ({
  page,
  request,
}) => {
  await withTemporaryEvent(async (event) => {
    const saved = await snapshotSettings();
    const since = new Date();
    const notice = `Fixture notice ${Date.now()}`;

    try {
      expect(await (await request.get("/")).text()).toContain('href="/events"');
      expect((await request.get(event)).status()).toBe(200);
      expect((await request.get(`${event}/calendar.ics`)).status()).toBe(200);

      await signIn(page, "fixture-admin@sandhi.test", "/admin/settings");
      // Settings never saved count as their defaults, so this is no change.
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Nothing changed.")).toBeVisible();

      await page.getByLabel("Notice text").fill(notice);
      await page.getByLabel("Show Events").uncheck();
      await page.getByLabel("GitHub").fill("http://github.com/insecure");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(
        page.getByText("GitHub needs a full https:// address."),
      ).toBeVisible();
      // A rejected save keeps everything that was typed.
      await expect(page.getByLabel("Notice text")).toHaveValue(notice);
      await expect(page.getByLabel("Show Events")).not.toBeChecked();

      await page.getByLabel("GitHub").fill("https://github.com/sandhi-fixture");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Settings saved.")).toBeVisible();

      // The public site follows at once.
      const home = await request.get("/");
      const html = await home.text();
      expect(html).toContain(notice);
      expect(html).not.toContain('href="/events"');
      expect(html).toContain('href="https://github.com/sandhi-fixture"');
      expect((await request.get("/events")).status()).toBe(404);
      expect((await request.get(event)).status()).toBe(404);
      expect((await request.get(`${event}/calendar.ics`)).status()).toBe(404);
      expect(await (await request.get("/sitemap.xml")).text()).not.toMatch(
        /\/events</u,
      );

      await open(page, "/");
      await expect(
        page.getByRole("complementary", { name: "Site notice" }),
      ).toHaveText(notice);

      // Saving again without changes records nothing new.
      await open(page, "/admin/settings");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Nothing changed.")).toBeVisible();

      await open(page, "/admin/audit?entity=SiteSetting");
      const rows = page.getByRole("row").filter({ hasText: "settings.update" });
      await expect(rows).toHaveCount(1);
      await rows.getByText("Changes").click();
      await expect(rows.locator("pre")).toContainText("features.showEvents");
      await expect(rows.locator("pre")).toContainText(notice);
    } finally {
      await restoreSettings(saved, since);
    }

    const restored = await request.get("/");
    const html = await restored.text();
    expect(html).not.toContain(notice);
    expect(html).toContain('href="/events"');
    expect((await request.get(event)).status()).toBe(200);
  });
});

test("reviewers cannot see or change settings or the audit log", async ({
  page,
  baseURL,
}) => {
  const saved = await snapshotSettings();
  const since = new Date();
  const origin = new URL(baseURL!).origin;

  // Genuine action references, taken from an administrator's page.
  await signIn(page, "fixture-admin@sandhi.test", "/admin/settings");
  const html = await (await page.request.get("/admin/settings")).text();
  const form = html
    .split("<form")
    .find((segment) => segment.includes('name="maintenanceBanner"'));
  expect(form).toBeDefined();
  const fields = Object.fromEntries(
    Array.from(
      form!.matchAll(
        /<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gu,
      ),
      (match) => [
        match[1]!,
        (match[2] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
      ],
    ),
  );
  expect(Object.keys(fields).length).toBeGreaterThan(0);
  await page.context().clearCookies();

  try {
    await signIn(page, "fixture-reviewer@sandhi.test", "/admin");
    const nav = page.getByRole("navigation", { name: "Administration" });
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    expect((await page.request.get("/admin/settings")).status()).toBe(404);
    expect((await page.request.get("/admin/audit")).status()).toBe(404);

    await page.request.post("/admin/settings", {
      headers: { Origin: origin },
      multipart: {
        ...fields,
        "contact.general": "attacker@example.org",
        "contact.research": "attacker@example.org",
        "contact.collaborations": "attacker@example.org",
        "contact.applications": "attacker@example.org",
        retentionMonths: "1",
        maintenanceBanner: "Defaced",
      },
    });

    const db = createPrismaClient();
    try {
      expect(
        await db.siteSetting.count({
          where: { key: "site.maintenanceBanner" },
        }),
      ).toBe(
        saved.filter(({ key }) => key === "site.maintenanceBanner").length,
      );
      expect(
        await db.auditLog.count({
          where: { action: "settings.update", createdAt: { gte: since } },
        }),
      ).toBe(0);
    } finally {
      await db.$disconnect();
    }
    expect(await (await page.request.get("/")).text()).not.toContain("Defaced");
  } finally {
    await restoreSettings(saved, since);
  }
});
