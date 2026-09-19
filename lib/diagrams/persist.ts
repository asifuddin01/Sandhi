/**
 * What is stored beside the Mermaid source: where each box sits and how it
 * looks. Mermaid cannot express either, and neither can be recovered from the
 * text, so they are saved as their own small document — and re-read
 * defensively, because a stored value is never trusted.
 */

import {
  emptyStyle,
  defaultCanvas,
  type CanvasSettings,
  type DiagramModel,
  type NodeGeometry,
  type ShapeStyle,
} from "@/lib/diagrams/model";
import { isGlyphName } from "@/lib/diagrams/glyphs";
import { isHexColour } from "@/lib/diagrams/palette";

export const LAYOUT_VERSION = 1;

export interface StoredLayout {
  version: number;
  canvas: CanvasSettings;
  nodes: Record<
    string,
    { geometry?: NodeGeometry; style?: ShapeStyle; glyph?: string | null }
  >;
  edges: Array<{ stroke: string | null; strokeWidth: number | null } | null>;
}

function number(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : null;
}

function readGeometry(value: unknown): NodeGeometry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const x = number(raw.x, 0, 20_000);
  const y = number(raw.y, 0, 20_000);
  const width = number(raw.width, 20, 4000);
  const height = number(raw.height, 20, 4000);
  if (x === null || y === null || width === null || height === null) {
    return undefined;
  }
  return { x, y, width, height };
}

function readStyle(value: unknown): ShapeStyle | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const colour = (input: unknown) => (isHexColour(input) ? input : null);
  return {
    fill: colour(raw.fill),
    stroke: colour(raw.stroke),
    text: colour(raw.text),
    strokeWidth: number(raw.strokeWidth, 1, 12),
    fontSize: number(raw.fontSize, 8, 48),
    dashed: raw.dashed === true,
  };
}

/** The layout of a model, as it is stored. */
export function toStoredLayout(model: DiagramModel): StoredLayout {
  return {
    version: LAYOUT_VERSION,
    canvas: model.canvas ?? defaultCanvas,
    nodes: Object.fromEntries(
      model.nodes.map((node) => [
        node.id,
        {
          geometry: node.geometry,
          style: node.style ?? emptyStyle,
          glyph: node.glyph ?? null,
        },
      ]),
    ),
    edges: model.edges.map((edge) => edge.style ?? null),
  };
}

/**
 * Puts a stored layout back onto a model parsed from the source. The source
 * decides what exists; the layout only says where it goes, so a box that was
 * deleted in the text does not come back, and a box added in the text simply
 * has no position yet and gets laid out.
 */
export function applyStoredLayout(
  model: DiagramModel,
  stored: unknown,
): DiagramModel {
  if (!stored || typeof stored !== "object") return model;
  const raw = stored as Record<string, unknown>;
  const nodes = (raw.nodes ?? {}) as Record<string, unknown>;
  const edges = Array.isArray(raw.edges) ? raw.edges : [];

  const canvasRaw = (raw.canvas ?? {}) as Record<string, unknown>;
  const canvas: CanvasSettings = {
    grid: number(canvasRaw.grid, 4, 80) ?? defaultCanvas.grid,
    showGrid: canvasRaw.showGrid !== false,
    snap: canvasRaw.snap !== false,
  };

  return {
    ...model,
    canvas,
    nodes: model.nodes.map((node) => {
      const entry = nodes[node.id] as Record<string, unknown> | undefined;
      if (!entry) return node;
      return {
        ...node,
        geometry: readGeometry(entry.geometry) ?? node.geometry,
        style: readStyle(entry.style) ?? node.style,
        glyph: isGlyphName(entry.glyph) ? entry.glyph : (node.glyph ?? null),
      };
    }),
    edges: model.edges.map((edge, index) => {
      const entry = edges[index] as Record<string, unknown> | null | undefined;
      if (!entry) return edge;
      return {
        ...edge,
        style: {
          stroke: isHexColour(entry.stroke) ? entry.stroke : null,
          strokeWidth: number(entry.strokeWidth, 1, 12),
        },
      };
    }),
  };
}
