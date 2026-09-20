import { describe, expect, it } from "vitest";

import {
  MAX_INTERESTS,
  MIN_PROFILE_BIO,
  describeGaps,
  isProfileComplete,
  profileGaps,
  readInterests,
} from "@/lib/portal/profile-fields";

const paragraph =
  "I work on segmentation of low-contrast structures in abdominal CT, and on what happens to those models when the scanner changes.";

describe("profileGaps", () => {
  it("is satisfied by a name, a description, and one interest", () => {
    expect(
      profileGaps({
        name: "A Person",
        bio: paragraph,
        interests: ["Medical imaging"],
      }),
    ).toEqual([]);
  });

  it("names everything missing from an untouched profile", () => {
    expect(profileGaps({ name: "", bio: null, interests: [] })).toEqual([
      "name",
      "bio",
      "interests",
    ]);
  });

  it("does not accept whitespace as an answer", () => {
    expect(
      profileGaps({
        name: "   ",
        bio: `   ${" ".repeat(MIN_PROFILE_BIO)}   `,
        interests: ["", "   "],
      }),
    ).toEqual(["name", "bio", "interests"]);
  });

  it("asks for more than a couple of words about the work", () => {
    expect(
      profileGaps({
        name: "A Person",
        bio: "Researcher.",
        interests: ["Medical imaging"],
      }),
    ).toEqual(["bio"]);
    expect(paragraph.length).toBeGreaterThanOrEqual(MIN_PROFILE_BIO);
  });

  /**
   * A photograph is the one thing somebody may not have on their first
   * morning. The form asks; the gate must not insist, or a missing picture
   * locks a new member out of their own projects.
   */
  it("never asks for a photograph", () => {
    expect(
      isProfileComplete({
        name: "A Person",
        bio: paragraph,
        interests: ["Medical imaging"],
      }),
    ).toBe(true);
  });

  it("reads as a sentence", () => {
    expect(describeGaps(["name"])).toBe("your name");
    expect(describeGaps(["name", "bio", "interests"])).toBe(
      "your name, a short description of your work and at least one research interest",
    );
    expect(describeGaps([])).toBe("");
  });
});

describe("readInterests", () => {
  it("takes one per line, trimmed and de-duplicated", () => {
    expect(
      readInterests("Medical imaging\n  Segmentation \n\nmedical imaging\n"),
    ).toEqual(["Medical imaging", "Segmentation"]);
  });

  it("accepts commas, since people type them", () => {
    expect(readInterests("Imaging, Segmentation")).toEqual([
      "Imaging",
      "Segmentation",
    ]);
  });

  it("stops at the limit rather than storing an unbounded list", () => {
    const many = Array.from({ length: 40 }, (_, index) => `Interest ${index}`);
    expect(readInterests(many.join("\n"))).toHaveLength(MAX_INTERESTS);
  });

  it("keeps a single interest within its own length limit", () => {
    const [interest] = readInterests("x".repeat(500));
    expect(interest!.length).toBe(160);
  });
});
