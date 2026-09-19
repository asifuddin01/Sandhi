/**
 * Small marks drawn inside a box, for the things a research pipeline is made
 * of: what goes in (images, speech, text, video), what it is trained on, what
 * comes out.
 *
 * Mermaid has no way to say "this box is about audio" without an icon pack, so
 * the glyph is ours: it is stored beside the source with the geometry, drawn
 * on the canvas, and carried into an SVG, PNG or PDF export. Mermaid text
 * exported on its own keeps the shape and the label, and loses the mark.
 *
 * Every path is drawn in a 24×24 box so one size fits them all.
 */

export interface Glyph {
  name: string;
  label: string;
  /** A sensible starting label when this glyph is what was asked for. */
  suggests: string;
  /** Paths drawn with the current stroke; none are filled. */
  paths: string[];
  /** Circles, where a dot reads better than a path. */
  dots?: Array<{ cx: number; cy: number; r: number; filled?: boolean }>;
}

export const GLYPHS: Glyph[] = [
  {
    name: "image",
    label: "Image",
    suggests: "Images",
    paths: ["M3 5 h18 v14 h-18 z", "M3 16 l5-5 4 4 3-3 6 6"],
    dots: [{ cx: 8.5, cy: 9, r: 1.4, filled: true }],
  },
  {
    name: "speech",
    label: "Speech",
    suggests: "Speech",
    paths: [
      "M12 3 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -6 0 v-6 a3 3 0 0 1 3 -3 z",
      "M5 11 a7 7 0 0 0 14 0",
      "M12 18 v3",
    ],
  },
  {
    name: "audio",
    label: "Audio",
    suggests: "Audio",
    paths: ["M3 12 h3 l2-5 3 10 3-13 3 8 2-3 h4"],
  },
  {
    name: "text",
    label: "Text",
    suggests: "Text",
    paths: ["M4 5 h16", "M4 10 h16", "M4 15 h11", "M4 20 h7"],
  },
  {
    name: "video",
    label: "Video",
    suggests: "Video",
    paths: ["M3 6 h12 v12 h-12 z", "M15 10 l6-3 v10 l-6-3 z"],
  },
  {
    name: "dataset",
    label: "Dataset",
    suggests: "Dataset",
    paths: [
      "M4 6 a8 3 0 0 1 16 0 v12 a8 3 0 0 1 -16 0 z",
      "M4 6 a8 3 0 0 0 16 0",
      "M4 12 a8 3 0 0 0 16 0",
    ],
  },
  {
    name: "model",
    label: "Model",
    suggests: "Model",
    paths: ["M5 7 h14 v10 h-14 z", "M9 7 v10", "M15 7 v10", "M5 12 h14"],
  },
  {
    name: "training",
    label: "Training",
    suggests: "Training",
    paths: [
      "M4 18 v-6",
      "M10 18 v-10",
      "M16 18 v-4",
      "M22 18 v-13",
      "M2 20 h20",
    ],
  },
  {
    name: "metrics",
    label: "Evaluation",
    suggests: "Evaluation",
    paths: ["M3 18 l5-6 4 3 8-9", "M3 21 h18"],
    dots: [{ cx: 20, cy: 6, r: 1.6, filled: true }],
  },
  {
    name: "embedding",
    label: "Embedding",
    suggests: "Embeddings",
    paths: [],
    dots: [
      { cx: 6, cy: 7, r: 1.7 },
      { cx: 12, cy: 12, r: 1.7 },
      { cx: 18, cy: 6, r: 1.7 },
      { cx: 8, cy: 17, r: 1.7 },
      { cx: 17, cy: 16, r: 1.7 },
    ],
  },
  {
    name: "document",
    label: "Document",
    suggests: "Paper",
    paths: ["M6 3 h8 l4 4 v14 h-12 z", "M14 3 v4 h4", "M9 12 h6", "M9 16 h6"],
  },
  {
    name: "cloud",
    label: "Service",
    suggests: "Service",
    paths: ["M7 18 a4 4 0 0 1 0-8 a5 5 0 0 1 9.6-1.4 A4 4 0 0 1 17 18 z"],
  },
  {
    name: "person",
    label: "Person",
    suggests: "Researcher",
    paths: ["M4 20 a8 7 0 0 1 16 0"],
    dots: [{ cx: 12, cy: 7, r: 4 }],
  },
  {
    name: "code",
    label: "Code",
    suggests: "Code",
    paths: ["M9 7 l-5 5 5 5", "M15 7 l5 5 -5 5"],
  },
];

export const GLYPH_NAMES = GLYPHS.map((glyph) => glyph.name);

export function findGlyph(name: string | null | undefined): Glyph | null {
  if (!name) return null;
  return GLYPHS.find((glyph) => glyph.name === name) ?? null;
}

export function isGlyphName(value: unknown): value is string {
  return typeof value === "string" && GLYPH_NAMES.includes(value);
}
