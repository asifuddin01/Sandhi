/**
 * Reading and writing the Mermaid flowchart subset the visual editor can
 * change. Text is the source of truth: everything this reader does not
 * understand is kept in `residual` and written back out, so opening a diagram
 * in the visual editor and saving it never removes anything.
 */

import {
  DIAGRAM_DIRECTIONS,
  EDGE_KINDS,
  NODE_SHAPES,
  emptyModel,
  isNodeId,
  type DiagramDirection,
  type DiagramEdge,
  type DiagramModel,
  type DiagramNode,
  type EdgeKind,
  type NodeShape,
} from "@/lib/diagrams/model";

export const MAX_SOURCE_LENGTH = 50_000;
export const MAX_NODES = 300;

/** Longest delimiters first, so `[[` is never read as `[`. */
const shapesByLength = (
  Object.entries(NODE_SHAPES) as Array<[NodeShape, (typeof NODE_SHAPES)[NodeShape]]>
).sort((left, right) => right[1].open.length - left[1].open.length);

const edgesBySyntax = (
  Object.entries(EDGE_KINDS) as Array<[EdgeKind, (typeof EDGE_KINDS)[EdgeKind]]>
).sort((left, right) => right[1].syntax.length - left[1].syntax.length);

function unquote(value: string): string {
  const trimmed = value.trim();
  return /^".*"$/su.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
}

/**
 * A label is quoted unless it is plainly safe unquoted. Quoting is what keeps
 * a bracket or an arrow inside a label from being read as structure.
 */
export function quoteLabel(label: string): string {
  const clean = label.replace(/["\r\n]/gu, " ").trim();
  return `"${clean}"`;
}

/** `id["Label"]`, or a bare `id`. Returns null when it is not a node at all. */
function readNode(text: string): DiagramNode | null {
  const source = text.trim();
  if (!source) return null;

  for (const [shape, { open, close }] of shapesByLength) {
    const start = source.indexOf(open);
    if (start <= 0 || !source.endsWith(close)) continue;
    const id = source.slice(0, start).trim();
    if (!isNodeId(id)) continue;
    const label = source.slice(start + open.length, source.length - close.length);
    return { id, label: unquote(label), shape, className: null };
  }

  return isNodeId(source)
    ? { id: source, label: source, shape: "rectangle", className: null }
    : null;
}

interface EdgeSplit {
  left: string;
  right: string;
  kind: EdgeKind;
  label: string | null;
}

/** Splits `A -->|yes| B` or `A -- yes --> B` into its parts. */
function splitEdge(line: string): EdgeSplit | null {
  // `A -- yes --> B` first: its label sits between two dashes before the
  // arrow, so looking for `-->` first would cut the line in the wrong place.
  const inline = /^(.*?)\s--\s([^-]+?)\s(-->|---)\s(.*)$/su.exec(line);
  if (inline) {
    return {
      left: inline[1]!,
      right: inline[4]!,
      kind: inline[3] === "---" ? "open" : "arrow",
      label: unquote(inline[2]!),
    };
  }

  for (const [kind, { syntax }] of edgesBySyntax) {
    const at = line.indexOf(syntax);
    if (at === -1) continue;

    const left = line.slice(0, at);
    let rest = line.slice(at + syntax.length);
    let label: string | null = null;

    const piped = /^\s*\|([^|]*)\|/u.exec(rest);
    if (piped) {
      label = unquote(piped[1] ?? "");
      rest = rest.slice(piped[0].length);
    }
    if (!rest.trim()) continue;
    return { left, right: rest, kind, label };
  }

  return null;
}

export interface ParsedSource {
  model: DiagramModel;
  /** Set when the text is not a flowchart this reader can edit visually. */
  problem: string | null;
}

/**
 * Reads Mermaid text into the editable model. A diagram that cannot be read
 * is not an error: the editor keeps working on the text and simply does not
 * offer the visual tools, which is honest about what it can and cannot change.
 */
export function parseFlowchart(source: string): ParsedSource {
  const lines = source.split(/\r?\n/u);
  const header = lines.findIndex((line) => line.trim());
  if (header === -1) {
    return { model: { ...emptyModel }, problem: "This diagram is empty." };
  }

  const opening = /^(?:flowchart|graph)\s+([A-Za-z]{2})\s*$/u.exec(
    lines[header]!.trim(),
  );
  if (!opening) {
    return {
      model: { ...emptyModel },
      problem:
        "Visual editing understands flowcharts. Start the diagram with `flowchart TD`.",
    };
  }

  const direction = (
    DIAGRAM_DIRECTIONS as readonly string[]
  ).includes(opening[1]!.toUpperCase())
    ? (opening[1]!.toUpperCase() as DiagramDirection)
    : "TD";

  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  const residual: string[] = [];

  const remember = (node: DiagramNode) => {
    const existing = nodes.get(node.id);
    // A later mention with a real label wins over a bare identifier.
    if (!existing || (existing.label === existing.id && node.label !== node.id)) {
      nodes.set(node.id, { ...existing, ...node });
    }
  };

  for (const raw of lines.slice(header + 1)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("class ")) {
      const applied = /^class\s+([A-Za-z0-9_,\s]+)\s+([A-Za-z0-9_]+)\s*$/u.exec(
        line,
      );
      if (applied) {
        for (const id of applied[1]!.split(",").map((part) => part.trim())) {
          const node = nodes.get(id);
          if (node) node.className = applied[2]!;
        }
        continue;
      }
    }
    // classDef, subgraph, click, style, comments: kept, not modelled.
    if (
      line.startsWith("%%") ||
      /^(classDef|subgraph|end|click|style|linkStyle|direction)\b/u.test(line)
    ) {
      residual.push(raw);
      continue;
    }

    const split = splitEdge(line);
    if (split) {
      const from = readNode(split.left);
      const to = readNode(split.right);
      if (from && to) {
        remember(from);
        remember(to);
        edges.push({
          from: from.id,
          to: to.id,
          label: split.label || null,
          kind: split.kind,
        });
        continue;
      }
    }

    const single = readNode(line);
    if (single) {
      remember(single);
      continue;
    }
    residual.push(raw);
  }

  return {
    model: { direction, nodes: [...nodes.values()], edges, residual },
    problem: null,
  };
}

/** Writes the model back as Mermaid text. */
export function toMermaid(model: DiagramModel): string {
  const lines = [`flowchart ${model.direction}`];

  for (const node of model.nodes) {
    const { open, close } = NODE_SHAPES[node.shape];
    lines.push(`  ${node.id}${open}${quoteLabel(node.label)}${close}`);
  }

  for (const edge of model.edges) {
    const { syntax } = EDGE_KINDS[edge.kind];
    const label = edge.label ? `|${quoteLabel(edge.label)}|` : "";
    lines.push(`  ${edge.from} ${syntax}${label} ${edge.to}`);
  }

  const classes = new Map<string, string[]>();
  for (const node of model.nodes) {
    if (!node.className) continue;
    classes.set(node.className, [
      ...(classes.get(node.className) ?? []),
      node.id,
    ]);
  }

  for (const line of model.residual) lines.push(line);
  for (const [className, ids] of classes) {
    lines.push(`  class ${ids.join(",")} ${className}`);
  }

  return `${lines.join("\n")}\n`;
}
