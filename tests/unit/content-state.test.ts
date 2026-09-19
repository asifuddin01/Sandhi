import { describe, expect, it } from "vitest";

import {
  deletable,
  parseBulkAction,
  parsePublishState,
  publicStatus,
  scheduleProblem,
  slugify,
  slugProblem,
  unscheduledStates,
} from "@/lib/content-state";
import { publicNewsWhere } from "@/lib/visibility";

const now = new Date("2026-09-19T12:00:00Z");
const past = new Date("2026-09-18T12:00:00Z");
const future = new Date("2026-09-20T12:00:00Z");

describe("publicStatus", () => {
  it("shows published records now, or from their publish time", () => {
    expect(publicStatus("PUBLISHED", null, now)).toBe("live");
    expect(publicStatus("PUBLISHED", past, now)).toBe("live");
    expect(publicStatus("PUBLISHED", future, now)).toBe("scheduled");
  });

  it("lets scheduled records go live on their own", () => {
    expect(publicStatus("SCHEDULED", future, now)).toBe("scheduled");
    expect(publicStatus("SCHEDULED", past, now)).toBe("live");
    expect(publicStatus("SCHEDULED", null, now)).toBe("hidden");
  });

  it("keeps drafts, reviews, and archives hidden", () => {
    for (const state of ["DRAFT", "IN_REVIEW", "ARCHIVED"] as const) {
      expect(publicStatus(state, past, now)).toBe("hidden");
    }
  });
});

describe("publicNewsWhere", () => {
  it("matches exactly what publicStatus calls live", () => {
    expect(publicNewsWhere(now)).toEqual({
      OR: [
        {
          state: "PUBLISHED",
          OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        },
        { state: "SCHEDULED", publishAt: { lte: now } },
      ],
    });
  });
});

describe("scheduleProblem", () => {
  it("needs a future time only when scheduling", () => {
    expect(scheduleProblem("DRAFT", null, now)).toBeNull();
    expect(scheduleProblem("SCHEDULED", null, now)).toMatch(/Choose when/u);
    expect(scheduleProblem("SCHEDULED", past, now)).toMatch(/future/u);
    expect(scheduleProblem("SCHEDULED", future, now)).toBeNull();
  });
});

describe("slugs", () => {
  it("makes readable addresses from titles", () => {
    expect(slugify("Sparse Attention, Revisited!")).toBe(
      "sparse-attention-revisited",
    );
    expect(slugify("  Café — Ümlaut 2026  ")).toBe("cafe-umlaut-2026");
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(100)).length).toBe(80);
  });

  it("accepts only lowercase words joined by single hyphens", () => {
    expect(slugProblem("sparse-attention")).toBeNull();
    expect(slugProblem("")).toMatch(/Enter/u);
    expect(slugProblem("Upper")).toMatch(/lowercase/u);
    expect(slugProblem("double--hyphen")).toMatch(/single/u);
    expect(slugProblem("-edge")).not.toBeNull();
    expect(slugProblem("a".repeat(81))).toMatch(/80/u);
  });
});

describe("states and bulk actions", () => {
  it("parses only known values", () => {
    expect(parsePublishState("PUBLISHED")).toBe("PUBLISHED");
    expect(parsePublishState("published")).toBeNull();
    expect(parsePublishState("SCHEDULED", unscheduledStates)).toBeNull();
    expect(parseBulkAction("archive")).toBe("archive");
    expect(parseBulkAction("drop")).toBeNull();
  });

  it("deletes only records that are not published", () => {
    expect(deletable("DRAFT")).toBe(true);
    expect(deletable("ARCHIVED")).toBe(true);
    expect(deletable("PUBLISHED")).toBe(false);
    expect(deletable("SCHEDULED")).toBe(false);
    expect(deletable("IN_REVIEW")).toBe(false);
  });
});
