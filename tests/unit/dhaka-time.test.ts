import { describe, expect, it } from "vitest";

import { fromDhakaInput, toDhakaInput } from "@/lib/dhaka-time";

describe("Dhaka time for admin forms", () => {
  it("round-trips a time through the form field", () => {
    const date = new Date("2026-09-20T03:30:00Z");
    expect(toDhakaInput(date)).toBe("2026-09-20T09:30");
    expect(fromDhakaInput("2026-09-20T09:30")?.toISOString()).toBe(
      "2026-09-20T03:30:00.000Z",
    );
  });

  it("crosses midnight correctly", () => {
    expect(fromDhakaInput("2026-01-01T02:00")?.toISOString()).toBe(
      "2025-12-31T20:00:00.000Z",
    );
  });

  it("refuses empty, malformed, and impossible values", () => {
    expect(toDhakaInput(null)).toBe("");
    for (const value of [
      "",
      "tomorrow",
      "2026-02-31T10:00",
      "2026-13-01T10:00",
    ]) {
      expect(fromDhakaInput(value), value).toBeNull();
    }
  });
});
