import { describe, expect, it } from "vitest";

import {
  isPublicationPublic,
  isPublishedAndDue,
  publicProjectResearch,
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
});
