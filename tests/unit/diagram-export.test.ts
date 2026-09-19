import { deflateSync, inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  A4_LANDSCAPE,
  A4_PORTRAIT,
  buildPdf,
  fitImage,
} from "@/lib/diagrams/pdf";
import {
  classDefinitions,
  customClassDefinition,
  customClassName,
  DIAGRAM_CLASSES,
  findClass,
  isHexColour,
} from "@/lib/diagrams/palette";

function samplePdf(width = 800, height = 400) {
  const rgb = new Uint8Array(width * height * 3).fill(200);
  return buildPdf(
    { width, height, deflated: new Uint8Array(deflateSync(rgb)) },
    { title: "Fixture diagram" },
  );
}

describe("fitImage", () => {
  it("fits inside the margins and centres what is left", () => {
    const placed = fitImage({ width: 2000, height: 1000 }, A4_LANDSCAPE);
    expect(placed.width).toBeLessThanOrEqual(A4_LANDSCAPE.width - 56);
    expect(placed.height).toBeLessThanOrEqual(A4_LANDSCAPE.height - 56);
    expect(placed.width / placed.height).toBeCloseTo(2, 5);
    expect(placed.x).toBeCloseTo((A4_LANDSCAPE.width - placed.width) / 2, 5);
  });

  it("never enlarges a small diagram past its own pixels", () => {
    const placed = fitImage({ width: 120, height: 80 }, A4_PORTRAIT);
    expect(placed.width).toBe(120);
    expect(placed.height).toBe(80);
  });
});

describe("buildPdf", () => {
  const pdf = samplePdf();
  const text = Buffer.from(pdf).toString("latin1");

  it("writes a PDF a reader can open", () => {
    expect(text.startsWith("%PDF-1.7")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Page ");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/Filter /FlateDecode");
  });

  /** A wrong offset table is the classic way a hand-written PDF fails to open. */
  it("points the cross-reference table at the real object offsets", () => {
    const startxref = Number(/startxref\n(\d+)/u.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");

    const rows = text
      .slice(startxref)
      .split("\n")
      .filter((line) => /^\d{10} \d{5} [nf] $/u.test(line));
    expect(rows).toHaveLength(7);

    rows.slice(1).forEach((row, index) => {
      const offset = Number(row.slice(0, 10));
      expect(text.slice(offset)).toMatch(
        new RegExp(`^${index + 1} 0 obj`, "u"),
      );
    });
  });

  it("keeps the image losslessly, exactly as it was handed over", () => {
    const start = text.indexOf("stream\n", text.indexOf("/Subtype /Image")) + 7;
    const end = text.indexOf("\nendstream", start);
    const stored = pdf.subarray(start, end);
    const pixels = inflateSync(Buffer.from(stored));
    expect(pixels).toHaveLength(800 * 400 * 3);
    expect(new Set(pixels)).toEqual(new Set([200]));
  });

  it("turns the page for a tall diagram and escapes the title", () => {
    const portrait = Buffer.from(samplePdf(400, 900)).toString("latin1");
    expect(portrait).toContain(`/MediaBox [0 0 595 842]`);
    const titled = buildPdf(
      {
        width: 10,
        height: 10,
        deflated: new Uint8Array(deflateSync(new Uint8Array(300))),
      },
      { title: "A (tricky) \\ title" },
    );
    expect(Buffer.from(titled).toString("latin1")).toContain(
      "(A \\(tricky\\) \\\\ title)",
    );
  });
});

describe("the diagram palette", () => {
  it("emits a definition only for the classes a diagram uses", () => {
    const lines = classDefinitions(["accent", "store", "nonexistent"]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("classDef accent fill:#2a1f12");
    expect(lines.join("\n")).not.toContain("plain");
  });

  it("gives every named class a fill, a stroke, and readable text", () => {
    for (const entry of DIAGRAM_CLASSES) {
      expect(isHexColour(entry.fill)).toBe(true);
      expect(isHexColour(entry.stroke)).toBe(true);
      expect(isHexColour(entry.text)).toBe(true);
    }
    expect(findClass("accent")?.label).toBe("Lamplight");
    expect(findClass("nope")).toBeNull();
  });

  it("names a custom colour after itself, so one colour is one definition", () => {
    expect(customClassName("#C98F4B")).toBe("cc98f4b");
    expect(customClassName("#c98f4b")).toBe("cc98f4b");
    expect(customClassDefinition("#c98f4b")).toContain("fill:#c98f4b");
  });

  it("refuses anything that is not a plain hex colour", () => {
    for (const value of ["red", "#fff", "#12345g", "url(x)", 42, null]) {
      expect(isHexColour(value)).toBe(false);
      expect(customClassName(value as string)).toBeNull();
    }
  });
});
