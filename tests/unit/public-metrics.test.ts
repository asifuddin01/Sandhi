import { describe, expect, it } from "vitest";

import { shouldShowPublicMetrics } from "@/lib/public-metrics";

const completeCounts = {
  researchers: 1,
  projects: 1,
  publications: 3,
  areas: 1,
};

describe("public metric visibility", () => {
  it("shows only when enabled and every threshold is met", () => {
    expect(shouldShowPublicMetrics(true, completeCounts)).toBe(true);
  });

  it("stays hidden below three public publications", () => {
    expect(
      shouldShowPublicMetrics(true, { ...completeCounts, publications: 2 }),
    ).toBe(false);
  });

  it("stays hidden when any value is zero or the feature is disabled", () => {
    expect(
      shouldShowPublicMetrics(true, { ...completeCounts, researchers: 0 }),
    ).toBe(false);
    expect(shouldShowPublicMetrics(false, completeCounts)).toBe(false);
  });
});
