import { describe, expect, it } from "vitest";

import {
  ALERT_COOLDOWN_MS,
  coarseNetwork,
  describeDevice,
  FAILED_ATTEMPT_ALERT_THRESHOLD,
  isNewSignIn,
  shouldAlertFailedAttempts,
} from "@/lib/security-signals";

describe("coarseNetwork", () => {
  it("keeps only the network part of an address", () => {
    expect(coarseNetwork("203.0.113.87")).toBe("203.0.113.0/24");
    expect(coarseNetwork("::ffff:198.51.100.4")).toBe("198.51.100.0/24");
    expect(coarseNetwork("2001:db8:85a3::8a2e:370:7334")).toBe(
      "2001:db8:85a3::/48",
    );
    expect(coarseNetwork("2001:0db8:0001:0000:0000:0000:0000:0001")).toBe(
      "2001:db8:1::/48",
    );
    expect(coarseNetwork("::1")).toBe("0:0:0::/48");
  });

  it("never stores something that is not an address", () => {
    expect(coarseNetwork(undefined)).toBe("unknown");
    expect(coarseNetwork("")).toBe("unknown");
    expect(coarseNetwork("999.1.1.1")).toBe("unknown");
    expect(coarseNetwork("<script>")).toBe("unknown");
    expect(coarseNetwork("1:2:3:4:5:6:7:8:9")).toBe("unknown");
  });
});

describe("describeDevice", () => {
  it("names common browsers and systems", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome on macOS");
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iOS");
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      ),
    ).toBe("Edge on Windows");
    expect(
      describeDevice(
        "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
      ),
    ).toBe("Firefox on Linux");
    expect(
      describeDevice(
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome on Android");
  });

  it("falls back without guessing", () => {
    expect(describeDevice(undefined)).toBe("Unknown device");
    expect(describeDevice("curl/8.7.1")).toBe("Unknown device");
  });
});

describe("isNewSignIn", () => {
  const home = { device: "Chrome on macOS", network: "203.0.113.0/24" };

  it("does not alert on an account's first sign-in", () => {
    expect(isNewSignIn([], home)).toBe(false);
  });

  it("alerts when the device or the network has not been seen", () => {
    expect(isNewSignIn([home], home)).toBe(false);
    expect(isNewSignIn([home], { ...home, network: "198.51.100.0/24" })).toBe(
      true,
    );
    expect(isNewSignIn([home], { ...home, device: "Firefox on Windows" })).toBe(
      true,
    );
  });
});

describe("shouldAlertFailedAttempts", () => {
  const now = new Date("2026-09-19T00:00:00Z");

  it("alerts once the threshold is reached", () => {
    expect(
      shouldAlertFailedAttempts(FAILED_ATTEMPT_ALERT_THRESHOLD - 1, null, now),
    ).toBe(false);
    expect(
      shouldAlertFailedAttempts(FAILED_ATTEMPT_ALERT_THRESHOLD, null, now),
    ).toBe(true);
  });

  it("sends at most one alert per cooldown", () => {
    const recent = new Date(now.getTime() - ALERT_COOLDOWN_MS + 1000);
    const old = new Date(now.getTime() - ALERT_COOLDOWN_MS);
    expect(shouldAlertFailedAttempts(9, recent, now)).toBe(false);
    expect(shouldAlertFailedAttempts(9, old, now)).toBe(true);
  });
});
