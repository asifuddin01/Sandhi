import { describe, expect, it } from "vitest";

import glyphData from "@/public/field/sandhi-points.json";

describe("Sandhi glyph point asset", () => {
  it("keeps a normalized, path-aware outline within the particle budget", () => {
    expect(glyphData.glyph).toBe("सन्धि");
    expect(glyphData.font).toBe("Tiro Devanagari Sanskrit 400");
    expect(glyphData.points.length).toBeGreaterThan(100);
    expect(glyphData.points.length).toBeLessThanOrEqual(1500);
    expect(glyphData.breaks).toEqual(
      [...glyphData.breaks].sort((a, b) => a - b),
    );
    expect(glyphData.breaks[0]).toBe(0);
    expect(glyphData.breaks.length).toBe(3);

    for (const [x, y] of glyphData.points) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
  });
});
