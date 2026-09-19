import { describe, expect, it } from "vitest";

import { isEmailAddress, MAX_EMAIL_LENGTH } from "@/lib/email-address";

describe("isEmailAddress", () => {
  it("accepts ordinary addresses", () => {
    for (const value of [
      "contact@sandhiresearch.org",
      "first.last+lab@mail.example.ac.bd",
      "a@b.co",
    ]) {
      expect(isEmailAddress(value), value).toBe(true);
    }
  });

  it("refuses anything that is not one address", () => {
    for (const value of [
      "",
      "no-at-sign",
      "two@@example.org",
      "space in@example.org",
      "dot@example..org",
      "trailing@example.",
      "nodomain@example",
      `${"a".repeat(MAX_EMAIL_LENGTH)}@example.org`,
    ]) {
      expect(isEmailAddress(value), value).toBe(false);
    }
  });

  it("answers crafted input at once instead of backtracking", () => {
    const crafted = [
      `a@${".".repeat(200_000)} `,
      `a@${"a.".repeat(100_000)}!`,
      `${"a".repeat(200_000)}@`,
    ];
    const started = performance.now();
    for (const value of crafted) expect(isEmailAddress(value)).toBe(false);
    // The old pattern took several seconds on the first of these.
    expect(performance.now() - started).toBeLessThan(50);
  });
});
