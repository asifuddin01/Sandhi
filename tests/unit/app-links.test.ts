import { describe, expect, it } from "vitest";

import {
  APP_LINK_EXCLUDED_PATHS,
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  isAndroidPackageName,
  isAppleAppId,
  parseAndroidFingerprints,
} from "@/lib/app-links";

const fingerprint = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, "0").toUpperCase(),
).join(":");

const env = (values: Record<string, string> = {}) =>
  ({ NODE_ENV: "test", ...values }) as NodeJS.ProcessEnv;

describe("parseAndroidFingerprints", () => {
  it("accepts a list, upper-cases it, and removes duplicates", () => {
    expect(
      parseAndroidFingerprints(`${fingerprint.toLowerCase()}, ${fingerprint}`),
    ).toEqual([fingerprint]);
  });

  it("drops anything that is not a SHA-256 fingerprint", () => {
    expect(parseAndroidFingerprints("AA:BB")).toEqual([]);
    expect(parseAndroidFingerprints(undefined)).toEqual([]);
    expect(parseAndroidFingerprints("")).toEqual([]);
  });
});

describe("identifiers", () => {
  it("recognises a package name and an Apple app id", () => {
    expect(isAndroidPackageName("org.sandhiresearch.app")).toBe(true);
    expect(isAndroidPackageName("sandhi")).toBe(false);
    expect(isAndroidPackageName("Org.Sandhi")).toBe(false);
    expect(isAppleAppId("ABCDE12345.org.sandhiresearch.app")).toBe(true);
    expect(isAppleAppId("org.sandhiresearch.app")).toBe(false);
  });
});

describe("buildAssetLinks", () => {
  it("publishes the app once the package and fingerprint are both set", () => {
    const links = buildAssetLinks(
      env({
        ANDROID_APP_ID: "org.sandhiresearch.app",
        ANDROID_APP_FINGERPRINTS: fingerprint,
      }),
    );
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toEqual({
      namespace: "android_app",
      package_name: "org.sandhiresearch.app",
      sha256_cert_fingerprints: [fingerprint],
    });
  });

  it("publishes nothing while either half is missing or malformed", () => {
    expect(buildAssetLinks(env())).toEqual([]);
    expect(
      buildAssetLinks(env({ ANDROID_APP_ID: "org.sandhiresearch.app" })),
    ).toEqual([]);
    expect(
      buildAssetLinks(
        env({
          ANDROID_APP_ID: "not a package",
          ANDROID_APP_FINGERPRINTS: fingerprint,
        }),
      ),
    ).toEqual([]);
  });
});

describe("buildAppleAppSiteAssociation", () => {
  it("lists the app and excludes the account and API paths", () => {
    const association = buildAppleAppSiteAssociation(
      env({ IOS_APP_ID: "ABCDE12345.org.sandhiresearch.app" }),
    )!;
    const detail = association.applinks.details[0]!;

    expect(detail.appIDs).toEqual(["ABCDE12345.org.sandhiresearch.app"]);
    expect(association.webcredentials.apps).toEqual(detail.appIDs);

    const excluded = detail.components.filter((part) => part.exclude);
    expect(excluded.map((part) => part["/"])).toEqual([
      ...APP_LINK_EXCLUDED_PATHS,
    ]);

    // Every exclusion must come before the paths it has to override.
    const firstIncluded = detail.components.findIndex((part) => !part.exclude);
    expect(
      detail.components
        .slice(firstIncluded)
        .every((part) => part.exclude !== true),
    ).toBe(true);

    const included = detail.components
      .slice(firstIncluded)
      .map((part) => part["/"]);
    expect(included).toContain("/publications/*");
    expect(included).not.toContain("/admin/*");
  });

  it("publishes nothing without a valid app id", () => {
    expect(buildAppleAppSiteAssociation(env())).toBeNull();
    expect(
      buildAppleAppSiteAssociation(
        env({ IOS_APP_ID: "org.sandhiresearch.app" }),
      ),
    ).toBeNull();
  });
});
