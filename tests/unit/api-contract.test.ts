import { describe, expect, it } from "vitest";

import {
  compareVersions,
  isClientOutdated,
  parseApiClient,
} from "@/lib/api/contract";

describe("parseApiClient", () => {
  it("reads the name, version, platform, and build", () => {
    expect(parseApiClient("sandhi-mobile/1.4.0 (android; build=42)")).toEqual({
      name: "sandhi-mobile",
      version: "1.4.0",
      platform: "android",
      build: 42,
    });
    expect(parseApiClient("SANDHI-Mobile/2.0 (iOS)")).toMatchObject({
      name: "sandhi-mobile",
      version: "2.0",
      platform: "ios",
      build: null,
    });
  });

  it("still identifies a client whose detail it cannot read", () => {
    expect(parseApiClient("sandhi-mobile")).toEqual({
      name: "sandhi-mobile",
      version: null,
      platform: "unknown",
      build: null,
    });
    expect(parseApiClient("sandhi-mobile/not-a-version (toaster)")).toEqual({
      name: "sandhi-mobile",
      version: null,
      platform: "unknown",
      build: null,
    });
  });

  it("refuses a missing, empty, oversized, or malformed header", () => {
    expect(parseApiClient(null)).toBeNull();
    expect(parseApiClient("   ")).toBeNull();
    expect(parseApiClient(`x/${"9".repeat(300)}`)).toBeNull();
    expect(parseApiClient("../../etc/passwd")).toBeNull();
    expect(parseApiClient("<script>/1.0")).toBeNull();
  });

  it("does not read a platform out of the middle of another word", () => {
    expect(parseApiClient("sandhi-mobile/1.0 (androidish)")?.platform).toBe(
      "unknown",
    );
  });
});

describe("compareVersions", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("2.0.1", "2.0")).toBe(1);
  });
});

describe("isClientOutdated", () => {
  const android = (version: string | null) =>
    ({
      name: "sandhi-mobile",
      version,
      platform: "android",
      build: null,
    }) as const;

  it("asks a released app below the minimum to update", () => {
    expect(isClientOutdated(android("1.2.0"), "1.3.0")).toBe(true);
    expect(isClientOutdated(android("1.3.0"), "1.3.0")).toBe(false);
    expect(isClientOutdated(android("2.0.0"), "1.3.0")).toBe(false);
  });

  it("leaves alone a browser, an unknown platform, and an unreadable version", () => {
    expect(
      isClientOutdated(
        { name: "web", version: "0.1", platform: "web", build: null },
        "1.3.0",
      ),
    ).toBe(false);
    expect(
      isClientOutdated(
        { name: "curl", version: "0.1", platform: "unknown", build: null },
        "1.3.0",
      ),
    ).toBe(false);
    expect(isClientOutdated(android(null), "1.3.0")).toBe(false);
  });

  it("locks nobody out when no minimum is set", () => {
    expect(isClientOutdated(android("0.0.1"), null)).toBe(false);
  });
});
