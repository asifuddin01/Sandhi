/**
 * Giving boxes positions.
 *
 * Mermaid describes what connects to what and leaves the placing to its own
 * engine, so a diagram that arrives as text has no coordinates. The canvas
 * needs them, and a person who then drags a box expects it to stay where they
 * put it — so positions are assigned once, here, and kept from then on.
 */

import {
  defaultSize,
  type DiagramModel,
  type DiagramNode,
  type NodeGeometry,
} from "@/lib/diagrams/model";

export const LAYOUT_GAP = { along: 90, across: 60 } as const;
export const CANVAS_PADDING = 40;

/**
 * How far each box is from a start: the longest path to it, so a box always
 * sits after everything that feeds it. Cycles stop at the first repeat rather
 * than looping.
 */
export function rankNodes(model: DiagramModel): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const node of model.nodes) incoming.set(node.id, []);
  for (const edge of model.edges) {
    if (edge.from === edge.to) continue;
    incoming.get(edge.to)?.push(edge.from);
  }

  const rank = new Map<string, number>();
  const visiting = new Set<string>();

  const depth = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    // A cycle: treat the edge that closes it as if it were not there.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const sources = incoming.get(id) ?? [];
    const value =
      sources.length === 0
        ? 0
        : Math.max(...sources.map((source) => depth(source) + 1));
    visiting.delete(id);
    rank.set(id, value);
    return value;
  };

  for (const node of model.nodes) depth(node.id);
  return rank;
}

const isVertical = (direction: string) =>
  direction === "TD" || direction === "BT";

/**
 * Positions for every box that has none, in rows (or columns) following the
 * diagram's direction. Boxes that already have a position keep it.
 */
export function layoutModel(model: DiagramModel): DiagramModel {
  if (model.nodes.every((node) => node.geometry)) return model;

  const rank = rankNodes(model);
  const rows = new Map<number, DiagramNode[]>();
  for (const node of model.nodes) {
    const at = rank.get(node.id) ?? 0;
    rows.set(at, [...(rows.get(at) ?? []), node]);
  }

  const vertical = isVertical(model.direction);
  const reversed = model.direction === "BT" || model.direction === "RL";
  const ordered = [...rows.keys()].sort((a, b) => a - b);
  const sized = new Map<string, { width: number; height: number }>(
    model.nodes.map((node) => [
      node.id,
      node.geometry ?? defaultSize(node.shape),
    ]),
  );

  // How deep each rank is, so ranks do not overlap when boxes differ in size.
  const rankExtent = ordered.map((at) =>
    Math.max(
      ...rows
        .get(at)!
        .map((node) =>
          vertical ? sized.get(node.id)!.height : sized.get(node.id)!.width,
        ),
    ),
  );
  const widest = Math.max(
    1,
    ...ordered.map((at) =>
      rows
        .get(at)!
        .reduce(
          (total, node) =>
            total +
            (vertical
              ? sized.get(node.id)!.width
              : sized.get(node.id)!.height) +
            LAYOUT_GAP.across,
          -LAYOUT_GAP.across,
        ),
    ),
  );

  const placed = new Map<string, NodeGeometry>();
  let along = CANVAS_PADDING;

  ordered.forEach((at, index) => {
    const row = rows.get(at)!;
    const span = row.reduce(
      (total, node) =>
        total +
        (vertical ? sized.get(node.id)!.width : sized.get(node.id)!.height) +
        LAYOUT_GAP.across,
      -LAYOUT_GAP.across,
    );
    let across = CANVAS_PADDING + (widest - span) / 2;

    for (const node of row) {
      const size = sized.get(node.id)!;
      const acrossSize = vertical ? size.width : size.height;
      placed.set(node.id, {
        width: size.width,
        height: size.height,
        x: Math.round(vertical ? across : along),
        y: Math.round(vertical ? along : across),
      });
      across += acrossSize + LAYOUT_GAP.across;
    }
    along += rankExtent[index]! + LAYOUT_GAP.along;
  });

  const total = along - LAYOUT_GAP.along + CANVAS_PADDING;
  const nodes = model.nodes.map((node) => {
    if (node.geometry) return node;
    const geometry = placed.get(node.id)!;
    if (!reversed) return { ...node, geometry };
    // Bottom-to-top and right-to-left read the other way round.
    return {
      ...node,
      geometry: vertical
        ? { ...geometry, y: total - geometry.y - geometry.height }
        : { ...geometry, x: total - geometry.x - geometry.width },
    };
  });

  return { ...model, nodes };
}

/** The area the boxes occupy, with room to breathe around them. */
export function canvasExtent(model: DiagramModel): {
  width: number;
  height: number;
} {
  let width = 640;
  let height = 420;
  for (const node of model.nodes) {
    if (!node.geometry) continue;
    width = Math.max(width, node.geometry.x + node.geometry.width);
    height = Math.max(height, node.geometry.y + node.geometry.height);
  }
  return { width: width + CANVAS_PADDING, height: height + CANVAS_PADDING };
}

/** Where a line from `towards` meets this box's edge, so arrows stop at it. */
export function borderPoint(
  box: NodeGeometry,
  towards: { x: number; y: number },
): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // The smaller scale is the side the line leaves through.
  const scaleX = dx === 0 ? Infinity : box.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : box.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function centreOf(box: NodeGeometry): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A free spot for a new box, below whatever is already there. */
export function freeSpot(model: DiagramModel): { x: number; y: number } {
  const bottom = model.nodes.reduce(
    (lowest, node) =>
      node.geometry
        ? Math.max(lowest, node.geometry.y + node.geometry.height)
        : lowest,
    0,
  );
  return {
    x: CANVAS_PADDING,
    y: bottom === 0 ? CANVAS_PADDING : bottom + LAYOUT_GAP.along,
  };
}
