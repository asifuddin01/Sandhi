import { describe, expect, it } from "vitest";

import { MAX_DATASETS, MAX_JSON_TEXT } from "@/lib/portal/experiment-limits";
import {
  parseDatasets,
  parseJsonField,
  parseTrackingUrl,
} from "@/lib/portal/experiment-input";

describe("parseJsonField", () => {
  it("reads an object", () => {
    const result = parseJsonField('{"lr": 0.001, "seed": 7}', "configuration");
    expect(result).toEqual({
      ok: true,
      value: { present: true, value: { lr: 0.001, seed: 7 } },
    });
  });

  it("tells an empty box apart from a typed null", () => {
    // Prisma stores these differently, and so should we: nothing recorded is
    // not the same as somebody recording that the answer was null.
    expect(parseJsonField("   ", "configuration")).toEqual({
      ok: true,
      value: { present: false, value: null },
    });
    expect(parseJsonField("null", "configuration")).toEqual({
      ok: true,
      value: { present: true, value: null },
    });
  });

  it("refuses what will not parse, and names the field", () => {
    const result = parseJsonField("{lr: 0.001}", "configuration");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe(
      "The configuration is not valid JSON.",
    );
  });

  it("checks the length before parsing it", () => {
    const huge = `["${"x".repeat(MAX_JSON_TEXT)}"]`;
    const result = parseJsonField(huge, "results");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe(
      "Keep the results shorter.",
    );
  });
});

describe("parseDatasets", () => {
  it("takes one per line and drops the blanks", () => {
    expect(parseDatasets("  one \n\n two\n")).toEqual({
      ok: true,
      value: ["one", "two"],
    });
  });

  it("keeps each dataset once", () => {
    expect(parseDatasets("one\none\ntwo")).toEqual({
      ok: true,
      value: ["one", "two"],
    });
  });

  it("refuses a list without end", () => {
    const many = Array.from({ length: MAX_DATASETS + 1 }, (_, i) => `d${i}`);
    expect(parseDatasets(many.join("\n")).ok).toBe(false);
  });

  it("refuses one absurdly long name", () => {
    expect(parseDatasets("x".repeat(400)).ok).toBe(false);
  });
});

describe("parseTrackingUrl", () => {
  it("keeps an https address", () => {
    expect(parseTrackingUrl(" https://wandb.ai/lab/run/1 ")).toEqual({
      ok: true,
      value: "https://wandb.ai/lab/run/1",
    });
  });

  it("treats an empty box as nothing recorded", () => {
    expect(parseTrackingUrl("")).toEqual({ ok: true, value: null });
  });

  it("refuses a scheme that is not https", () => {
    // `javascript:` parses as a URL perfectly well, and this value ends up
    // in an href.
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://wandb.ai/lab/run/1",
      "wandb.ai/lab/run/1",
      "not a url at all",
    ]) {
      expect(parseTrackingUrl(bad).ok, bad).toBe(false);
    }
  });
});
