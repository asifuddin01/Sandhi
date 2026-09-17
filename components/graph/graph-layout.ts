import type { GraphEdge, GraphNode, GraphNodeKind } from "@/lib/graph-types";

/** Layers read left to right, like the layers of a network diagram. */
export const layerOrder: GraphNodeKind[] = [
  "theme",
  "area",
  "project",
  "person",
  "publication",
];

export const layerHeadings: Record<GraphNodeKind, string> = {
  theme: "Themes",
  area: "Research areas",
  project: "Projects",
  person: "Researchers",
  publication: "Publications",
};

// People and publications are numerous; their names appear on focus only.
const labelledKinds = new Set<GraphNodeKind>(["theme", "area", "project"]);

const EDGE_MARGIN = 8;
const LANE_GAP = 16;
const COLUMN_PADDING = 40;
const NARROW_COLUMN_PADDING = 24;
// A readable edge length between layers. The drawing asks for exactly this
// much (its natural width); extra width only lengthens edges, so columns never
// spread further apart.
const MAX_COLUMN_GAP = 300;
const MIN_NATURAL_WIDTH = 480;
// Breathing room between the last names and whatever sits beside the drawing.
const TRAILING_SPACE = 32;
// Outer labels sit beside their nodes only when the columns keep this gap.
const MIN_SIDE_COLUMN_GAP = 128;
const MAX_SIDE_LABEL_SHARE = 0.3;
const SIDE_LABEL_GAP = 10;
const SIDE_LABEL_BASELINE = 4.5;
// Truncated names stay useful only with this much room; otherwise a column
// shows names on focus.
const MIN_TRUNCATED_LABEL_WIDTH = 112;
const ROW_GAP = 56;
const LAYER_TOP = 92;
const LAYER_BOTTOM = 36;
const MIN_HEIGHT = 360;
const COORDINATE_PASSES = 4;
const HEADING_Y = 28;
const STAGGERED_HEADING_Y = 50;
const LABEL_OFFSET = 9;
const ELLIPSIS = "…";

export type MeasureText = (text: string) => number;
export type TextAnchor = "start" | "middle" | "end";
export type LabelPlacement = "above" | "side";

export interface LaidOutNode {
  id: string;
  layer: number;
  x: number;
  y: number;
  radius: number;
  /** Always-visible label, already fitted to its lane; null when hidden. */
  label: string | null;
  labelPlacement: LabelPlacement;
  labelAnchor: TextAnchor;
  labelDx: number;
  labelDy: number;
}

export interface LaidOutEdge {
  id: string;
  /** Endpoint in the earlier layer; signals travel from here by default. */
  from: string;
  to: string;
  fromLayer: number;
  toLayer: number;
  path: string;
}

export interface LayerHeading {
  kind: GraphNodeKind;
  text: string;
  x: number;
  y: number;
  anchor: TextAnchor;
}

export interface GraphLayout {
  width: number;
  /** The width at which the layers sit a readable gap apart. */
  naturalWidth: number;
  height: number;
  layers: string[][];
  nodes: Map<string, LaidOutNode>;
  edges: LaidOutEdge[];
  headings: LayerHeading[];
}

export interface PlacedLabel {
  text: string;
  x: number;
  y: number;
  anchor: TextAnchor;
}

interface LaneEntry {
  /** The text anchor point, after the anchor offset from the node. */
  point: number;
  anchor: TextAnchor;
  width: number;
}

interface ColumnPlan {
  x: number[];
  placements: LabelPlacement[];
  anchors: TextAnchor[];
  /** Room for side labels; zero for columns labelled above. */
  sideRoom: number[];
}

export function nodeRadius(kind: GraphNodeKind): number {
  if (kind === "theme") return 10;
  if (kind === "area") return 8;
  if (kind === "project") return 7;
  return 6;
}

export function graphHeight(largestLayer: number): number {
  return Math.max(
    MIN_HEIGHT,
    LAYER_TOP + LAYER_BOTTOM + Math.max(0, largestLayer - 1) * ROW_GAP,
  );
}

/** Estimates UI text width before the rendered font can be measured. */
export function estimateTextWidth(text: string): number {
  return text.length * 7.9;
}

export function fitText(
  text: string,
  maxWidth: number,
  measure: MeasureText,
): string {
  if (measure(text) <= maxWidth) return text;

  let low = 0;
  let high = text.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(`${text.slice(0, middle).trimEnd()}${ELLIPSIS}`) <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low > 0 ? `${text.slice(0, low).trimEnd()}${ELLIPSIS}` : "";
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function evenRows(count: number, height: number): number[] {
  const center = (LAYER_TOP + height - LAYER_BOTTOM) / 2;
  return Array.from(
    { length: count },
    (_, index) => center + (index - (count - 1) / 2) * ROW_GAP,
  );
}

function adjacency(
  nodes: GraphNode[],
  edges: GraphEdge[],
  kinds: GraphNodeKind[],
) {
  const layerOf = new Map(
    nodes.map((node) => [node.id, kinds.indexOf(node.kind)]),
  );
  const neighbours = new Map<string, string[]>();
  for (const edge of edges) {
    if (!layerOf.has(edge.source) || !layerOf.has(edge.target)) continue;
    neighbours.set(edge.source, [
      ...(neighbours.get(edge.source) ?? []),
      edge.target,
    ]);
    neighbours.set(edge.target, [
      ...(neighbours.get(edge.target) ?? []),
      edge.source,
    ]);
  }
  return { layerOf, neighbours };
}

/**
 * Orders each layer by the mean height of its connections in earlier layers
 * (a barycentre sweep), which removes most edge crossings while keeping the
 * editorial order of themes and any ties.
 */
export function orderLayers(
  nodes: GraphNode[],
  edges: GraphEdge[],
  kinds: GraphNodeKind[],
  height: number,
): string[][] {
  const { layerOf, neighbours } = adjacency(nodes, edges, kinds);
  const yById = new Map<string, number>();

  return kinds.map((kind, layer) => {
    const members = nodes.filter((node) => node.kind === kind);
    const rows = evenRows(members.length, height);
    const keyed = members.map((node, index) => {
      let weighted = 0;
      let total = 0;

      if (layer > 0) {
        for (const other of neighbours.get(node.id) ?? []) {
          const otherLayer = layerOf.get(other) ?? layer;
          const otherY = yById.get(other);
          if (otherLayer >= layer || otherY === undefined) continue;
          const weight = 1 / (layer - otherLayer);
          weighted += weight * otherY;
          total += weight;
        }
      }

      return {
        id: node.id,
        index,
        key: total > 0 ? weighted / total : rows[index]!,
      };
    });

    keyed.sort((a, b) => a.key - b.key || a.index - b.index);
    keyed.forEach((entry, index) => yById.set(entry.id, rows[index]!));
    return keyed.map((entry) => entry.id);
  });
}

/**
 * Keeps the largest layer evenly spaced and draws every other node towards the
 * mean height of its connections, preserving order and a minimum row gap. A
 * theme therefore sits level with the areas it contains, so edges fan evenly.
 */
export function assignRows(
  layers: string[][],
  neighbours: Map<string, string[]>,
  layerOf: Map<string, number>,
  height: number,
): Map<string, number> {
  const y = new Map<string, number>();
  layers.forEach((ids) =>
    evenRows(ids.length, height).forEach((row, index) =>
      y.set(ids[index]!, row),
    ),
  );
  if (layers.length < 2) return y;

  const anchor = layers.reduce(
    (largest, ids, index) =>
      ids.length > layers[largest]!.length ? index : largest,
    0,
  );
  const order = layers
    .map((_, index) => index)
    .filter((index) => index !== anchor && layers[index]!.length > 0)
    .sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor) || a - b);
  const top = LAYER_TOP;
  const bottom = height - LAYER_BOTTOM;

  for (let pass = 0; pass < COORDINATE_PASSES; pass += 1) {
    for (const layer of order) {
      const ids = layers[layer]!;
      const desired = ids.map((id) => {
        let weighted = 0;
        let total = 0;
        for (const other of neighbours.get(id) ?? []) {
          const otherLayer = layerOf.get(other);
          if (otherLayer === undefined || otherLayer === layer) continue;
          const weight = 1 / Math.abs(layer - otherLayer);
          weighted += weight * y.get(other)!;
          total += weight;
        }
        return total > 0 ? weighted / total : y.get(id)!;
      });

      // Push rows down to keep the gap from the top, then up to keep it from
      // the bottom. A layer never holds more rows than the largest one, so
      // both bounds and every gap can hold at once.
      const placed: number[] = [];
      desired.forEach((row, index) => {
        placed.push(
          index === 0
            ? Math.max(row, top)
            : Math.max(row, placed[index - 1]! + ROW_GAP),
        );
      });
      for (let index = placed.length - 1; index >= 0; index -= 1) {
        placed[index] =
          index === placed.length - 1
            ? Math.min(placed[index]!, bottom)
            : Math.min(placed[index]!, placed[index + 1]! - ROW_GAP);
      }
      // Re-centre on the desired rows without leaving the drawing.
      const shift = Math.min(
        bottom - placed[placed.length - 1]!,
        Math.max(top - placed[0]!, mean(desired) - mean(placed)),
      );
      placed.forEach((row, index) => y.set(ids[index]!, row + shift));
    }
  }

  return y;
}

/**
 * Splits the horizontal space between neighbouring text lanes. Each side keeps
 * what it needs up to half of a shared gap, and unused room goes to the other.
 * Returns the widest text each entry may draw without crossing a neighbour.
 */
export function allocateLanes(entries: LaneEntry[], width: number): number[] {
  const leftNeed = entries.map(({ anchor, width: textWidth }) =>
    anchor === "start" ? 0 : anchor === "middle" ? textWidth / 2 : textWidth,
  );
  const rightNeed = entries.map(({ anchor, width: textWidth }) =>
    anchor === "end" ? 0 : anchor === "middle" ? textWidth / 2 : textWidth,
  );
  const leftRoom = entries.map(({ point }, index) =>
    index === 0 ? point - EDGE_MARGIN : 0,
  );
  const rightRoom = entries.map(({ point }, index) =>
    index === entries.length - 1 ? width - EDGE_MARGIN - point : 0,
  );

  for (let index = 0; index < entries.length - 1; index += 1) {
    const available = Math.max(
      0,
      entries[index + 1]!.point - entries[index]!.point - LANE_GAP,
    );
    const half = available / 2;
    let right = Math.min(rightNeed[index]!, half);
    let left = Math.min(leftNeed[index + 1]!, half);
    const spare = available - right - left;
    right += Math.min(rightNeed[index]! - right, spare);
    left += Math.min(leftNeed[index + 1]! - left, available - right - left);
    rightRoom[index] = right;
    leftRoom[index + 1] = left;
  }

  return entries.map(({ anchor }, index) => {
    const left = Math.max(0, leftRoom[index]!);
    const right = Math.max(0, rightRoom[index]!);
    if (anchor === "start") return right;
    if (anchor === "end") return left;
    return 2 * Math.min(left, right);
  });
}

function aboveAnchor(column: number, columns: number): TextAnchor {
  if (columns === 1) return "middle";
  if (column === 0) return "start";
  return column === columns - 1 ? "end" : "middle";
}

function aboveOffset(anchor: TextAnchor, radius: number): number {
  if (anchor === "start") return -radius;
  return anchor === "end" ? radius : 0;
}

/**
 * Chooses column positions. When there is room, the outer columns carry their
 * names outside the network (inputs on the left, outputs on the right) and the
 * network starts at the content edge with capped gaps; otherwise names sit
 * above nodes.
 */
function planColumns(
  widest: number[],
  radii: number[],
  width: number,
): ColumnPlan {
  const columns = widest.length;
  if (columns === 1) {
    return {
      x: [width / 2],
      placements: ["above"],
      anchors: ["middle"],
      sideRoom: [0],
    };
  }

  const last = columns - 1;
  const maxSideLabel = width * MAX_SIDE_LABEL_SHARE;
  const leftLabel = Math.min(widest[0]!, maxSideLabel);
  const rightLabel = Math.min(widest[last]!, maxSideLabel);
  const labelsFit =
    leftLabel >= Math.min(widest[0]!, MIN_TRUNCATED_LABEL_WIDTH) &&
    rightLabel >= Math.min(widest[last]!, MIN_TRUNCATED_LABEL_WIDTH);
  const leftExtent =
    radii[0]! + (leftLabel > 0 ? SIDE_LABEL_GAP + leftLabel : 0);
  const rightExtent =
    radii[last]! + (rightLabel > 0 ? SIDE_LABEL_GAP + rightLabel : 0);
  const sideGap =
    (width - EDGE_MARGIN * 2 - leftExtent - rightExtent) / (columns - 1);

  if (labelsFit && sideGap >= MIN_SIDE_COLUMN_GAP) {
    const gap = Math.min(MAX_COLUMN_GAP, sideGap);
    // Start at the content edge, like the page's text, not centred.
    const firstX = EDGE_MARGIN + leftExtent;
    return {
      x: widest.map((_, column) => firstX + column * gap),
      placements: widest.map((labelWidth, column) =>
        (column === 0 || column === last) && labelWidth > 0 ? "side" : "above",
      ),
      anchors: widest.map((labelWidth, column) => {
        if (column === 0 && labelWidth > 0) return "end";
        if (column === last && labelWidth > 0) return "start";
        return aboveAnchor(column, columns);
      }),
      sideRoom: widest.map((_, column) =>
        column === 0 ? leftLabel : column === last ? rightLabel : 0,
      ),
    };
  }

  const padding = width < 480 ? NARROW_COLUMN_PADDING : COLUMN_PADDING;
  const gap = Math.min(MAX_COLUMN_GAP, (width - padding * 2) / (columns - 1));
  const firstX = (width - gap * (columns - 1)) / 2;
  return {
    x: widest.map((_, column) => firstX + column * gap),
    placements: widest.map(() => "above"),
    anchors: widest.map((_, column) => aboveAnchor(column, columns)),
    sideRoom: widest.map(() => 0),
  };
}

function edgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
): string {
  if (Math.abs(target.x - source.x) < 1) {
    const bend = Math.max(source.x, target.x) + 48;
    return `M ${round(source.x)} ${round(source.y)} C ${round(bend)} ${round(source.y)}, ${round(bend)} ${round(target.y)}, ${round(target.x)} ${round(target.y)}`;
  }

  const middle = round((source.x + target.x) / 2);
  return `M ${round(source.x)} ${round(source.y)} C ${middle} ${round(source.y)}, ${middle} ${round(target.y)}, ${round(target.x)} ${round(target.y)}`;
}

/**
 * Lays the public graph out as aligned layers. Labels are fitted into lanes
 * between columns or beside the outer columns, so no always-visible label can
 * overlap another column's label or leave the drawing, at any width.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  measure: MeasureText,
): GraphLayout {
  const kinds = layerOrder.filter((kind) =>
    nodes.some((node) => node.kind === kind),
  );
  const largestLayer = Math.max(
    0,
    ...kinds.map((kind) => nodes.filter((node) => node.kind === kind).length),
  );
  const height = graphHeight(largestLayer);
  const layers = orderLayers(nodes, edges, kinds, height);
  const { layerOf, neighbours } = adjacency(nodes, edges, kinds);
  const rows = assignRows(layers, neighbours, layerOf, height);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const radii = kinds.map(nodeRadius);
  const labelled = kinds.map((kind) => labelledKinds.has(kind));
  const widestLabel = (column: number) =>
    labelled[column]
      ? Math.max(
          0,
          ...layers[column]!.map((id) =>
            measure(nodeById.get(id)?.label ?? ""),
          ),
        )
      : 0;
  const plan = planColumns(
    kinds.map((_, column) => widestLabel(column)),
    radii,
    width,
  );
  const offsets = kinds.map((_, column) =>
    plan.placements[column] === "side"
      ? (plan.anchors[column] === "end" ? -1 : 1) *
        (radii[column]! + SIDE_LABEL_GAP)
      : aboveOffset(plan.anchors[column]!, radii[column]!),
  );
  const lanePoint = (column: number) => plan.x[column]! + offsets[column]!;

  // Side labels have their own room. Labels above nodes share lanes; a column
  // whose lane is too narrow shows names on focus only, and its room is offered
  // to its neighbours.
  const budgets = kinds.map((_, column) => plan.sideRoom[column]!);
  for (let pass = 0; pass < 2; pass += 1) {
    const laneBudgets = allocateLanes(
      kinds.map((_, column) =>
        plan.placements[column] === "side"
          ? {
              point: plan.x[column]!,
              anchor: column === 0 ? ("start" as const) : ("end" as const),
              width: 0,
            }
          : {
              point: lanePoint(column),
              anchor: plan.anchors[column]!,
              width: widestLabel(column),
            },
      ),
      width,
    );
    let changed = false;
    kinds.forEach((_, column) => {
      if (plan.placements[column] === "side") return;
      budgets[column] = laneBudgets[column]!;
      const needed = Math.min(widestLabel(column), MIN_TRUNCATED_LABEL_WIDTH);
      if (labelled[column] && laneBudgets[column]! < needed) {
        labelled[column] = false;
        changed = true;
      }
    });
    if (!changed) break;
  }

  const laidOut = new Map<string, LaidOutNode>();
  layers.forEach((ids, layer) => {
    const placement = plan.placements[layer]!;
    ids.forEach((id) => {
      const node = nodeById.get(id)!;
      const radius = nodeRadius(node.kind);
      const label = labelled[layer]
        ? fitText(node.label, budgets[layer]!, measure) || null
        : null;
      laidOut.set(id, {
        id,
        layer,
        x: round(plan.x[layer]!),
        y: round(rows.get(id)!),
        radius,
        label,
        labelPlacement: placement,
        labelAnchor: plan.anchors[layer]!,
        labelDx: offsets[layer]!,
        labelDy:
          placement === "side" ? SIDE_LABEL_BASELINE : -(radius + LABEL_OFFSET),
      });
    });
  });

  const laidOutEdges: LaidOutEdge[] = [];
  for (const edge of edges) {
    const source = laidOut.get(edge.source);
    const target = laidOut.get(edge.target);
    if (!source || !target) continue;
    const [from, to] =
      source.layer <= target.layer ? [source, target] : [target, source];
    laidOutEdges.push({
      id: edge.id,
      from: from.id,
      to: to.id,
      fromLayer: from.layer,
      toLayer: to.layer,
      path: edgePath(from, to),
    });
  }

  // Headings align with each column's names; alternate two rows when tight.
  const headingEntries = kinds.map((kind, column) => {
    const anchor = plan.anchors[column]!;
    return {
      point:
        plan.placements[column] === "side"
          ? plan.x[column]! + (anchor === "end" ? 1 : -1) * radii[column]!
          : lanePoint(column),
      anchor,
      width: measure(layerHeadings[kind]),
    };
  });
  const singleRow = allocateLanes(headingEntries, width);
  const staggered = singleRow.some(
    (budget, column) => budget < headingEntries[column]!.width,
  );
  const headingBudgets = [...singleRow];
  if (staggered) {
    for (const parity of [0, 1]) {
      const rowColumns = kinds
        .map((_, column) => column)
        .filter((column) => column % 2 === parity);
      allocateLanes(
        rowColumns.map((column) => headingEntries[column]!),
        width,
      ).forEach((budget, index) => {
        headingBudgets[rowColumns[index]!] = budget;
      });
    }
  }

  const headings = kinds.map((kind, column) => ({
    kind,
    text: fitText(layerHeadings[kind], headingBudgets[column]!, measure),
    x: round(headingEntries[column]!.point),
    y: staggered && column % 2 === 1 ? STAGGERED_HEADING_Y : HEADING_Y,
    anchor: headingEntries[column]!.anchor,
  }));

  // Measured from the layer kinds, not the lane decisions above, so the natural
  // width never depends on the width the drawing was given.
  const widestName = (column: number) =>
    labelledKinds.has(kinds[column]!)
      ? Math.max(
          0,
          ...layers[column]!.map((id) =>
            measure(nodeById.get(id)?.label ?? ""),
          ),
        )
      : 0;
  const lastColumn = kinds.length - 1;
  const widestFirst = widestName(0);
  const widestLast = lastColumn > 0 ? widestName(lastColumn) : 0;
  const naturalWidth =
    kinds.length <= 1
      ? MIN_NATURAL_WIDTH
      : Math.max(
          MIN_NATURAL_WIDTH,
          Math.ceil(
            EDGE_MARGIN * 2 +
              radii[0]! +
              (widestFirst > 0 ? SIDE_LABEL_GAP + widestFirst : 0) +
              radii[lastColumn]! +
              (widestLast > 0 ? SIDE_LABEL_GAP + widestLast : 0) +
              lastColumn * MAX_COLUMN_GAP +
              TRAILING_SPACE,
          ),
        );

  return {
    width,
    naturalWidth,
    height,
    layers,
    nodes: laidOut,
    edges: laidOutEdges,
    headings,
  };
}

/** Places a focused node's full name where its label belongs, in the drawing. */
export function placeFocusLabel(
  node: LaidOutNode,
  label: string,
  width: number,
  measure: MeasureText,
): PlacedLabel {
  if (node.labelPlacement === "side") {
    const x = node.x + node.labelDx;
    const room =
      node.labelAnchor === "end" ? x - EDGE_MARGIN : width - EDGE_MARGIN - x;
    return {
      text: fitText(label, room, measure),
      x,
      y: node.y + node.labelDy,
      anchor: node.labelAnchor,
    };
  }

  const text = fitText(label, width - EDGE_MARGIN * 2, measure);
  const textWidth = measure(text);
  const y = node.y - node.radius - LABEL_OFFSET;

  if (node.x - textWidth / 2 < EDGE_MARGIN) {
    return { text, x: EDGE_MARGIN, y, anchor: "start" };
  }
  if (node.x + textWidth / 2 > width - EDGE_MARGIN) {
    return { text, x: width - EDGE_MARGIN, y, anchor: "end" };
  }
  return { text, x: node.x, y, anchor: "middle" };
}
