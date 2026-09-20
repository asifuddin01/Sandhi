import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("not used");
  },
  isDatabaseConfigured: () => false,
}));

import { toTsQuery } from "@/lib/search";

describe("toTsQuery", () => {
  it("searches for every word, and the last one as a prefix", () => {
    // A search box is used while still typing: "neur" has to find "neural".
    expect(toTsQuery("neural")).toBe("neural:*");
    expect(toTsQuery("medical imaging")).toBe("medical & imaging:*");
  });

  /**
   * Everything a person types is reduced to letters and digits, so no input
   * can be read as tsquery syntax. `to_tsquery` raises on malformed input,
   * which would otherwise turn a stray bracket into a 500.
   */
  it("cannot be steered by tsquery syntax", () => {
    expect(toTsQuery("cat & dog")).toBe("cat & dog:*");
    expect(toTsQuery("cat | dog")).toBe("cat & dog:*");
    expect(toTsQuery("cat & !dog")).toBe("cat & dog:*");
    expect(toTsQuery("(unbalanced")).toBe("unbalanced:*");
    expect(toTsQuery("a:*:*:*")).toBe("a:*");
    expect(toTsQuery("'; DROP TABLE \"Project\"; --")).toBe(
      "drop & table & project:*",
    );
  });

  it("keeps letters that are not English", () => {
    expect(toTsQuery("সন্ধি")).toBe("সন্ধি:*");
    expect(toTsQuery("Müller 2026")).toBe("müller & 2026:*");
  });

  it("has nothing to search for when nothing was typed", () => {
    expect(toTsQuery("")).toBeNull();
    expect(toTsQuery("   ")).toBeNull();
    expect(toTsQuery("!!! ???")).toBeNull();
  });
});
