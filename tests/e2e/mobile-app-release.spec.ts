import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import type { Prisma } from "../../generated/prisma/client";
import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

// Publishing the app changes what every page's menu shows.
test.describe.configure({ mode: "serial" });

const RELEASE = {
  version: "1.4.0",
  versionCode: "14",
  downloadUrl: "https://files.example.org/sandhi-fixture-1.4.0.apk",
  sizeBytes: "31457280",
  sha256: "b".repeat(64),
};

type StoredSetting = { key: string; value: Prisma.JsonValue };

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

test("an administrator publishes the app, and the site and API follow", async ({
  page,
  request,
}) => {
  const saved = await snapshotSettings();
  const since = new Date();

  try {
    expect((await request.get("/app")).status()).toBe(404);

    await signIn(page, "fixture-admin@sandhi.test", "/admin/settings");

    // Half a release is a mistake worth naming, not a silent omission.
    await page.getByLabel("Publish the app page").check();
    await page.getByLabel("Version", { exact: true }).first().fill("1.4.0");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      page.getByText("The APK needs a full https:// address."),
    ).toBeVisible();

    await page.getByLabel("Signed APK address").fill(RELEASE.downloadUrl);
    await page.getByLabel("Version code").fill(RELEASE.versionCode);
    await page.getByLabel("Size in bytes").fill(RELEASE.sizeBytes);
    await page.getByLabel("SHA-256 of the APK").fill(RELEASE.sha256);
    await page.getByLabel("Minimum Android version").fill("10");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    // The download page appears, states the facts, and is reachable.
    const appPage = await request.get("/app");
    expect(appPage.status()).toBe(200);
    const html = await appPage.text();
    expect(html).toContain("1.4.0");
    expect(html).toContain(RELEASE.sha256);
    expect(html).toContain("30 MB");

    const redirect = await request.get("/download/android", {
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers().location).toBe(RELEASE.downloadUrl);

    // The API and the page read the same rows, so they cannot disagree.
    const release = (await (
      await request.get("/api/v1/app/release")
    ).json()) as {
      data: { published: boolean; android: { version: string } | null };
    };
    expect(release.data.published).toBe(true);
    expect(release.data.android?.version).toBe("1.4.0");

    expect(await (await request.get("/sitemap.xml")).text()).toContain("/app");

    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
    ).toEqual([]);

    // An app older than the minimum is asked to update before anything else.
    await page.goto("/admin/settings");
    await page.getByLabel("Minimum supported version").fill("9.0.0");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    const outdated = await request.get("/api/v1/home", {
      headers: { "x-sandhi-client": "sandhi-mobile/1.0.0 (android; build=1)" },
    });
    expect(outdated.status()).toBe(426);
    const refusal = (await outdated.json()) as {
      error: { code: string; details: { minimumVersion: string } };
    };
    expect(refusal.error.code).toBe("upgrade_required");
    expect(refusal.error.details.minimumVersion).toBe("9.0.0");

    // A current app, and a browser, are unaffected.
    expect(
      (
        await request.get("/api/v1/home", {
          headers: {
            "x-sandhi-client": "sandhi-mobile/9.1.0 (android; build=91)",
          },
        })
      ).status(),
    ).toBe(200);
    expect((await request.get("/api/v1/home")).status()).toBe(200);
  } finally {
    await restoreSettings(saved, since);
  }

  expect((await request.get("/app")).status()).toBe(404);
  expect((await request.get("/api/v1/home")).status()).toBe(200);
});
