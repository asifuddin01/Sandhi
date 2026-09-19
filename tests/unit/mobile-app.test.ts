import { describe, expect, it } from "vitest";

import {
  defaultMobileAppSettings,
  formatBytes,
  normalizeSha256,
  parseMobileAppSettings,
  readMobileAppForm,
} from "@/lib/mobile-app";
import {
  hiddenSectionPaths,
  parseSiteSettings,
  settingKeys,
  defaultSiteSettings,
} from "@/lib/site-settings-schema";

const sha = "a".repeat(64);

const androidRelease = {
  version: "1.2.0",
  versionCode: 12,
  downloadUrl: "https://files.sandhiresearch.org/app/sandhi-1.2.0.apk",
  sizeBytes: 31_457_280,
  sha256: sha,
  minimumOsVersion: "10",
  notes: "First release.",
};

describe("parseMobileAppSettings", () => {
  it("keeps a complete release", () => {
    const parsed = parseMobileAppSettings({
      enabled: true,
      minimumVersion: "1.0.0",
      android: androidRelease,
      ios: {
        version: "1.2.0",
        distribution: "testflight",
        installUrl: "https://testflight.apple.com/join/example",
      },
    });
    expect(parsed.enabled).toBe(true);
    expect(parsed.android).toMatchObject(androidRelease);
    expect(parsed.ios).toMatchObject({ distribution: "testflight" });
    expect(parsed.minimumVersion).toBe("1.0.0");
  });

  it("drops a release that is missing its version or address", () => {
    expect(
      parseMobileAppSettings({ enabled: true, android: { version: "1.0.0" } })
        .android,
    ).toBeNull();
    expect(
      parseMobileAppSettings({
        enabled: true,
        android: { ...androidRelease, version: "banana" },
      }).android,
    ).toBeNull();
  });

  it("refuses an address that is not https", () => {
    expect(
      parseMobileAppSettings({
        enabled: true,
        android: { ...androidRelease, downloadUrl: "http://example.org/a.apk" },
      }).android,
    ).toBeNull();
    expect(
      parseMobileAppSettings({
        enabled: true,
        android: {
          ...androidRelease,
          downloadUrl: "javascript:alert(1)",
        },
      }).android,
    ).toBeNull();
  });

  it("drops a checksum, size, or version code it cannot trust", () => {
    const parsed = parseMobileAppSettings({
      enabled: true,
      android: {
        ...androidRelease,
        sha256: "not-a-hash",
        sizeBytes: -5,
        versionCode: 1.5,
      },
    });
    expect(parsed.android).toMatchObject({
      sha256: null,
      sizeBytes: null,
      versionCode: null,
    });
  });

  it("stays unpublished until there is something to install", () => {
    expect(parseMobileAppSettings({ enabled: true }).enabled).toBe(false);
    expect(parseMobileAppSettings(null)).toEqual(defaultMobileAppSettings);
    expect(parseMobileAppSettings("nonsense")).toEqual(
      defaultMobileAppSettings,
    );
  });

  it("falls back to TestFlight for an unknown iOS distribution", () => {
    expect(
      parseMobileAppSettings({
        enabled: true,
        ios: {
          version: "1.0.0",
          distribution: "sideload",
          installUrl: "https://example.org/install",
        },
      }).ios?.distribution,
    ).toBe("testflight");
  });
});

describe("readMobileAppForm", () => {
  const read = (values: Record<string, string>, ticked: string[] = []) =>
    readMobileAppForm(
      (name) => values[name] ?? "",
      (name) => ticked.includes(name),
    );

  it("accepts a complete Android release", () => {
    const { value, problems } = read(
      {
        "mobile.android.version": "1.2.0",
        "mobile.android.downloadUrl": androidRelease.downloadUrl,
        "mobile.android.sha256": sha.toUpperCase(),
        "mobile.android.sizeBytes": "31457280",
        "mobile.android.versionCode": "12",
        "mobile.minimumVersion": "1.0.0",
      },
      ["mobile.enabled"],
    );
    expect(problems).toEqual([]);
    expect(value.enabled).toBe(true);
    expect(value.android?.sha256).toBe(sha);
  });

  it("names a half-filled platform rather than silently dropping it", () => {
    const { problems } = read({ "mobile.android.version": "1.2.0" });
    expect(problems.map((problem) => problem.field)).toContain(
      "mobile.android.downloadUrl",
    );
  });

  it("refuses a bad checksum, size, version code, and minimum version", () => {
    const { problems } = read({
      "mobile.android.version": "1.2.0",
      "mobile.android.downloadUrl": androidRelease.downloadUrl,
      "mobile.android.sha256": "xyz",
      "mobile.android.sizeBytes": "big",
      "mobile.android.versionCode": "1.5",
      "mobile.minimumVersion": "latest",
    });
    expect(problems.map((problem) => problem.field).sort()).toEqual([
      "mobile.android.sha256",
      "mobile.android.sizeBytes",
      "mobile.android.versionCode",
      "mobile.minimumVersion",
    ]);
  });

  it("cannot be published with nothing to install", () => {
    expect(read({}, ["mobile.enabled"]).value.enabled).toBe(false);
  });

  it("leaves everything empty when the whole section is blank", () => {
    expect(read({}).value).toEqual(defaultMobileAppSettings);
  });
});

describe("site settings", () => {
  it("reads the app settings from their stored row", () => {
    const settings = parseSiteSettings([
      {
        key: settingKeys.mobileApp,
        value: { enabled: true, android: androidRelease },
      },
    ]);
    expect(settings.mobileApp.android?.version).toBe("1.2.0");
  });

  it("hides /app until a build is published", () => {
    expect(hiddenSectionPaths(defaultSiteSettings)).toContain("/app");
    expect(
      hiddenSectionPaths({
        ...defaultSiteSettings,
        mobileApp: parseMobileAppSettings({
          enabled: true,
          android: androidRelease,
        }),
      }),
    ).not.toContain("/app");
  });
});

describe("presentation helpers", () => {
  it("formats sizes without hiding how large a download is", () => {
    expect(formatBytes(31_457_280)).toBe("30 MB");
    expect(formatBytes(5_242_880)).toBe("5.0 MB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(0)).toBeNull();
    expect(formatBytes(null)).toBeNull();
  });

  it("normalises a checksum written with spaces or capitals", () => {
    expect(normalizeSha256(` ${sha.toUpperCase()} `)).toBe(sha);
    expect(normalizeSha256("abc")).toBeNull();
  });
});
