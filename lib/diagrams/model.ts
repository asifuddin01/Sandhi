/**
 * The editable shape of an architecture diagram.
 *
 * Mermaid text is the source of truth — it is what people paste in, what is
 * stored, and what is exported. This model is a reading of that text that the
 * visual editor can change safely, and `mermaid-source.ts` turns it back.
 * Anything the reader does not understand is kept verbatim, so a round trip
 * never quietly deletes someone's work.
 */

export const DIAGRAM_DIRECTIONS = ["TD", "LR", "BT", "RL"] as const;
export type DiagramDirection = (typeof DIAGRAM_DIRECTIONS)[number];

export const directionLabels: Record<DiagramDirection, string> = {
  TD: "Top to bottom",
  LR: "Left to right",
  BT: "Bottom to top",
  RL: "Right to left",
};

/** The shapes an architecture diagram actually uses, and their delimiters. */
export const NODE_SHAPES = {
  rectangle: { open: "[", close: "]", label: "Rectangle" },
  rounded: { open: "(", close: ")", label: "Rounded" },
  stadium: { open: "([", close: "])", label: "Stadium" },
  subroutine: { open: "[[", close: "]]", label: "Subroutine" },
  cylinder: { open: "[(", close: ")]", label: "Database" },
  circle: { open: "((", close: "))", label: "Circle" },
  diamond: { open: "{", close: "}", label: "Decision" },
  hexagon: { open: "{{", close: "}}", label: "Hexagon" },
} as const;

export type NodeShape = keyof typeof NODE_SHAPES;

export const EDGE_KINDS = {
  arrow: { syntax: "-->", label: "Arrow" },
  open: { syntax: "---", label: "Line" },
  dotted: { syntax: "-.->", label: "Dotted" },
  thick: { syntax: "==>", label: "Thick" },
} as const;

export type EdgeKind = keyof typeof EDGE_KINDS;

export interface DiagramNode {
  /** The Mermaid identifier. Unique within a diagram. */
  id: string;
  label: string;
  shape: NodeShape;
  /** The name of a colour class from `palette.ts`, when one is applied. */
  className: string | null;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label: string | null;
  kind: EdgeKind;
}

export interface DiagramModel {
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /**
   * Lines the reader did not recognise — subgraphs, comments, click handlers,
   * anything newer than this model. Kept and re-emitted unchanged.
   */
  residual: string[];
}

export const emptyModel: DiagramModel = {
  direction: "TD",
  nodes: [],
  edges: [],
  residual: [],
};

/** Mermaid identifiers: a letter or digit, then word characters. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]{0,63}$/u;

export function isNodeId(value: string): boolean {
  return ID_PATTERN.test(value);
}

/**
 * A fresh identifier that reads as a name rather than a number: `n1` is
 * meaningless in exported source, `payments_2` is not.
 */
export function nextNodeId(model: DiagramModel, hint = "node"): string {
  const base = hint
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 40);
  const stem = base && /^[a-z]/u.test(base) ? base : `node_${base || "1"}`;
  const taken = new Set(model.nodes.map((node) => node.id));
  if (!taken.has(stem)) return stem;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${stem}_${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem}_${Date.now()}`;
}

/** Removing a node removes what pointed at it; a dangling edge is not a diagram. */
export function removeNode(model: DiagramModel, id: string): DiagramModel {
  return {
    ...model,
    nodes: model.nodes.filter((node) => node.id !== id),
    edges: model.edges.filter((edge) => edge.from !== id && edge.to !== id),
  };
}

/** Renaming an identifier carries every edge that named it. */
export function renameNode(
  model: DiagramModel,
  from: string,
  to: string,
): DiagramModel {
  if (from === to) return model;
  if (!isNodeId(to) || model.nodes.some((node) => node.id === to)) return model;
  return {
    ...model,
    nodes: model.nodes.map((node) =>
      node.id === from ? { ...node, id: to } : node,
    ),
    edges: model.edges.map((edge) => ({
      ...edge,
      from: edge.from === from ? to : edge.from,
      to: edge.to === from ? to : edge.to,
    })),
  };
}

export function moveNode(
  model: DiagramModel,
  id: string,
  by: -1 | 1,
): DiagramModel {
  const index = model.nodes.findIndex((node) => node.id === id);
  const target = index + by;
  if (index === -1 || target < 0 || target >= model.nodes.length) return model;
  const nodes = [...model.nodes];
  [nodes[index], nodes[target]] = [nodes[target]!, nodes[index]!];
  return { ...model, nodes };
}
