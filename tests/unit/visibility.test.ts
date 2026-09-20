import { describe, expect, it } from "vitest";

import {
  isPublicationPublic,
  isNewsPublic,
  isPublishedAndDue,
  NEWS_PUBLISHABLE_STATES,
  publicProjectResearch,
  publicProjectUpdateWhere,
  publicProjectWhere,
} from "@/lib/visibility";

describe("public visibility", () => {
  it("allows only accepted, published, or identified preprint publications", () => {
    expect(
      isPublicationPublic({
        state: "PUBLISHED",
        stage: "ACCEPTED",
        type: "CONFERENCE",
      }),
    ).toBe(true);
    expect(
      isPublicationPublic({
        state: "PUBLISHED",
        stage: "SUBMITTED",
        type: "PREPRINT",
        arxivId: "2401.00001",
      }),
    ).toBe(true);
    expect(
      isPublicationPublic({
        state: "DRAFT",
        stage: "PUBLISHED",
        type: "JOURNAL",
      }),
    ).toBe(false);
    expect(
      isPublicationPublic({
        state: "PUBLISHED",
        stage: "SUBMITTED",
        type: "PREPRINT",
        arxivId: null,
      }),
    ).toBe(false);
  });

  it("requires scheduled public records to be due", () => {
    const now = new Date("2026-09-16T00:00:00.000Z");
    expect(
      isPublishedAndDue(
        { state: "PUBLISHED", publishAt: "2026-09-15T00:00:00.000Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isPublishedAndDue(
        { state: "PUBLISHED", publishAt: "2026-09-17T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  /**
   * The predicate exists so a cached query can drop the clock and apply it
   * afterwards. If it disagreed with `publicNewsWhere`, the cached pages
   * would show a different set of posts from the uncached ones — and the
   * first thing to disappear would be a scheduled post that had just become
   * due.
   */
  describe("isNewsPublic matches publicNewsWhere", () => {
    const now = new Date("2026-09-16T00:00:00.000Z");
    const past = new Date("2026-09-15T00:00:00.000Z");
    const future = new Date("2026-09-17T00:00:00.000Z");

    it("shows a published post with no date, and one whose date has passed", () => {
      expect(isNewsPublic({ state: "PUBLISHED", publishAt: null }, now)).toBe(
        true,
      );
      expect(isNewsPublic({ state: "PUBLISHED", publishAt: past }, now)).toBe(
        true,
      );
    });

    it("holds a published post back until its date", () => {
      expect(isNewsPublic({ state: "PUBLISHED", publishAt: future }, now)).toBe(
        false,
      );
    });

    /**
     * The case `isPublishedAndDue` gets wrong: scheduling needs no job to
     * flip the state, so a SCHEDULED post is public once its time passes.
     */
    it("shows a scheduled post once its time has passed, and not before", () => {
      expect(isNewsPublic({ state: "SCHEDULED", publishAt: past }, now)).toBe(
        true,
      );
      expect(isNewsPublic({ state: "SCHEDULED", publishAt: future }, now)).toBe(
        false,
      );
      // A scheduled post with no date is not due, and never will be.
      expect(isNewsPublic({ state: "SCHEDULED", publishAt: null }, now)).toBe(
        false,
      );
    });

    it("shows nothing in any other state", () => {
      for (const state of ["DRAFT", "ARCHIVED", "IN_REVIEW"]) {
        expect(isNewsPublic({ state, publishAt: past }, now)).toBe(false);
      }
    });

    it("lists exactly the states that can become public", () => {
      expect([...NEWS_PUBLISHABLE_STATES]).toEqual(["PUBLISHED", "SCHEDULED"]);
    });
  });

  it("redacts experiments and results until resultsPublic is true", () => {
    expect(
      publicProjectResearch({
        resultsPublic: false,
        experiments: "private experiment",
        results: "private result",
      }),
    ).toMatchObject({ experiments: null, results: null });

    expect(
      publicProjectResearch({
        resultsPublic: true,
        experiments: "public experiment",
        results: "public result",
      }),
    ).toMatchObject({
      experiments: "public experiment",
      results: "public result",
    });
  });

  it("needs both halves before a progress update is public", () => {
    // Publishing a project must not retroactively publish working notes, and
    // publishing a note must not leak an unpublished project.
    expect(publicProjectUpdateWhere).toEqual({
      isPublic: true,
      project: publicProjectWhere,
    });
  });
});
