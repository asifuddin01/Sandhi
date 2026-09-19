"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { borderPoint, canvasExtent, centreOf } from "@/lib/diagrams/layout";
import {
  emptyStyle,
  snapTo,
  type DiagramModel,
  type DiagramNode,
  type NodeGeometry,
} from "@/lib/diagrams/model";
import { findGlyph } from "@/lib/diagrams/glyphs";
import { DIAGRAM_CLASSES, findClass } from "@/lib/diagrams/palette";

import styles from "./Diagrams.module.css";

export type Selection =
  { kind: "node"; id: string } | { kind: "edge"; index: number } | null;

const MIN_SIZE = { width: 60, height: 40 };
/**
 * The colours a box falls back to. Literal, not CSS variables: the canvas is
 * exported as it stands, and a variable means nothing in a file opened
 * somewhere else.
 */
const FALLBACK = DIAGRAM_CLASSES[0]!;
const EDGE_COLOUR = "#8c95ab";
const HANDLE = 9;

interface Drag {
  mode: "move" | "resize" | "connect";
  id: string;
  from: { x: number; y: number };
  geometry: NodeGeometry;
  /** Where the pointer is now, for the connection line being drawn. */
  at: { x: number; y: number };
  over: string | null;
}

/** The outline for each shape, drawn in the box's own rectangle. */
function ShapeOutline({
  node,
  geometry,
  fill,
  stroke,
  strokeWidth,
  dashed,
}: {
  node: DiagramNode;
  geometry: NodeGeometry;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
}) {
  const { x, y, width: w, height: h } = geometry;
  const common = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray: dashed ? "6 4" : undefined,
  };

  switch (node.shape) {
    case "circle":
      return (
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2}
          ry={h / 2}
          {...common}
        />
      );
    case "diamond":
      return (
        <polygon
          points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
          {...common}
        />
      );
    case "hexagon": {
      const inset = Math.min(24, w / 4);
      return (
        <polygon
          points={`${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h / 2} ${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${y + h / 2}`}
          {...common}
        />
      );
    }
    case "cylinder": {
      const lip = Math.min(16, h / 5);
      return (
        <g>
          <path
            d={`M ${x} ${y + lip} A ${w / 2} ${lip} 0 0 1 ${x + w} ${y + lip} L ${x + w} ${y + h - lip} A ${w / 2} ${lip} 0 0 1 ${x} ${y + h - lip} Z`}
            {...common}
          />
          <path
            d={`M ${x} ${y + lip} A ${w / 2} ${lip} 0 0 0 ${x + w} ${y + lip}`}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </g>
      );
    }
    case "doubleCircle":
      return (
        <g>
          <ellipse
            cx={x + w / 2}
            cy={y + h / 2}
            rx={w / 2}
            ry={h / 2}
            {...common}
          />
          <ellipse
            cx={x + w / 2}
            cy={y + h / 2}
            rx={w / 2 - 6}
            ry={h / 2 - 6}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </g>
      );
    case "parallelogram": {
      const skew = Math.min(26, w / 5);
      return (
        <polygon
          points={`${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`}
          {...common}
        />
      );
    }
    case "parallelogramAlt": {
      const skew = Math.min(26, w / 5);
      return (
        <polygon
          points={`${x},${y} ${x + w - skew},${y} ${x + w},${y + h} ${x + skew},${y + h}`}
          {...common}
        />
      );
    }
    case "trapezoid": {
      const skew = Math.min(26, w / 5);
      return (
        <polygon
          points={`${x + skew},${y} ${x + w - skew},${y} ${x + w},${y + h} ${x},${y + h}`}
          {...common}
        />
      );
    }
    case "flag": {
      const notch = Math.min(22, w / 6);
      return (
        <polygon
          points={`${x},${y} ${x + w - notch},${y} ${x + w},${y + h / 2} ${x + w - notch},${y + h} ${x},${y + h}`}
          {...common}
        />
      );
    }
    case "stadium":
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} {...common} />;
    case "rounded":
      return <rect x={x} y={y} width={w} height={h} rx={14} {...common} />;
    case "subroutine": {
      const bar = Math.min(12, w / 8);
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} {...common} />
          <line
            x1={x + bar}
            y1={y}
            x2={x + bar}
            y2={y + h}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <line
            x1={x + w - bar}
            y1={y}
            x2={x + w - bar}
            y2={y + h}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </g>
      );
    }
    default:
      return <rect x={x} y={y} width={w} height={h} {...common} />;
  }
}

/** The mark a box carries, drawn at a fixed size in the top-left of it. */
function GlyphMark({
  name,
  x,
  y,
  size,
  colour,
}: {
  name: string;
  x: number;
  y: number;
  size: number;
  colour: string;
}) {
  const glyph = findGlyph(name);
  if (!glyph) return null;
  const scale = size / 24;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="none"
      stroke={colour}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    >
      {glyph.paths.map((path) => (
        <path key={path} d={path} />
      ))}
      {glyph.dots?.map((dot) => (
        <circle
          key={`${dot.cx}-${dot.cy}`}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill={dot.filled ? colour : "none"}
        />
      ))}
    </g>
  );
}

/** Breaks a label into lines that fit the box, roughly by character width. */
function wrap(label: string, width: number, fontSize: number): string[] {
  const perLine = Math.max(6, Math.floor(width / (fontSize * 0.58)));
  const words = label.split(/\s+/u).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= perLine) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

export interface CanvasProps {
  model: DiagramModel;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onChange: (model: DiagramModel) => void;
  readOnly?: boolean;
  /** Handed the live SVG, which is what an export is taken from. */
  onMounted?: (svg: SVGSVGElement | null) => void;
}

export function DiagramCanvas({
  model,
  selection,
  onSelect,
  onChange,
  readOnly = false,
  onMounted,
}: CanvasProps) {
  const svg = useRef<SVGSVGElement>(null);
  const hold = useCallback(
    (element: SVGSVGElement | null) => {
      svg.current = element;
      onMounted?.(element);
    },
    [onMounted],
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const canvas = model.canvas ?? { grid: 10, showGrid: true, snap: true };
  const extent = canvasExtent(model);

  const placed = model.nodes.filter(
    (node): node is DiagramNode & { geometry: NodeGeometry } =>
      Boolean(node.geometry),
  );
  const byId = new Map(placed.map((node) => [node.id, node]));

  /** Pointer position in the diagram's own coordinates. */
  const pointAt = useCallback(
    (event: { clientX: number; clientY: number }): { x: number; y: number } => {
      const box = svg.current?.getBoundingClientRect();
      if (!box) return { x: 0, y: 0 };
      return {
        x: ((event.clientX - box.left) / box.width) * extent.width,
        y: ((event.clientY - box.top) / box.height) * extent.height,
      };
    },
    [extent.width, extent.height],
  );

  const setGeometry = (id: string, geometry: NodeGeometry) =>
    onChange({
      ...model,
      nodes: model.nodes.map((node) =>
        node.id === id ? { ...node, geometry } : node,
      ),
    });

  function startDrag(
    event: PointerEvent,
    mode: Drag["mode"],
    node: DiagramNode & { geometry: NodeGeometry },
  ) {
    if (readOnly) return;
    event.stopPropagation();
    event.preventDefault();
    const at = pointAt(event);
    setDrag({
      mode,
      id: node.id,
      from: at,
      geometry: node.geometry,
      at,
      over: null,
    });
    onSelect({ kind: "node", id: node.id });
  }

  function onPointerMove(event: { clientX: number; clientY: number }) {
    if (!drag) return;
    const at = pointAt(event);
    const dx = at.x - drag.from.x;
    const dy = at.y - drag.from.y;

    if (drag.mode === "move") {
      setGeometry(drag.id, {
        ...drag.geometry,
        x: Math.max(0, snapTo(drag.geometry.x + dx, canvas.grid, canvas.snap)),
        y: Math.max(0, snapTo(drag.geometry.y + dy, canvas.grid, canvas.snap)),
      });
      return;
    }
    if (drag.mode === "resize") {
      setGeometry(drag.id, {
        ...drag.geometry,
        width: Math.max(
          MIN_SIZE.width,
          snapTo(drag.geometry.width + dx, canvas.grid, canvas.snap),
        ),
        height: Math.max(
          MIN_SIZE.height,
          snapTo(drag.geometry.height + dy, canvas.grid, canvas.snap),
        ),
      });
      return;
    }

    // Drawing a connection: highlight whatever is under the pointer.
    const over =
      placed.find(
        (node) =>
          node.id !== drag.id &&
          at.x >= node.geometry.x &&
          at.x <= node.geometry.x + node.geometry.width &&
          at.y >= node.geometry.y &&
          at.y <= node.geometry.y + node.geometry.height,
      )?.id ?? null;
    setDrag({ ...drag, at, over });
  }

  function endDrag() {
    if (drag?.mode === "connect" && drag.over) {
      const exists = model.edges.some(
        (edge) => edge.from === drag.id && edge.to === drag.over,
      );
      if (!exists) {
        onChange({
          ...model,
          edges: [
            ...model.edges,
            { from: drag.id, to: drag.over, label: null, kind: "arrow" },
          ],
        });
      }
    }
    setDrag(null);
  }

  /**
   * A drag is followed on the window, not on the canvas: pointer capture is
   * refused for some pointer ids, and a person dragging a box past the edge
   * of the canvas still expects it to follow.
   */
  useEffect(() => {
    if (!drag) return;
    const move = (event: globalThis.PointerEvent) => onPointerMove(event);
    const up = () => endDrag();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  /** Arrow keys nudge the selection, so the canvas works without a pointer. */
  function onKeyDown(event: React.KeyboardEvent) {
    if (readOnly || selection?.kind !== "node") return;
    const node = byId.get(selection.id);
    if (!node) return;

    const step = event.shiftKey ? canvas.grid * 5 : canvas.grid || 1;
    const nudge: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const move = nudge[event.key];
    if (move) {
      event.preventDefault();
      setGeometry(node.id, {
        ...node.geometry,
        x: Math.max(0, node.geometry.x + move[0]),
        y: Math.max(0, node.geometry.y + move[1]),
      });
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onChange({
        ...model,
        nodes: model.nodes.filter((candidate) => candidate.id !== node.id),
        edges: model.edges.filter(
          (edge) => edge.from !== node.id && edge.to !== node.id,
        ),
      });
      onSelect(null);
    }
  }

  const gridId = "diagram-grid";

  return (
    <svg
      ref={hold}
      className={styles.board}
      viewBox={`0 0 ${extent.width} ${extent.height}`}
      role="application"
      aria-label="Diagram canvas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={() => onSelect(null)}
    >
      <defs>
        <pattern
          id={gridId}
          width={canvas.grid}
          height={canvas.grid}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${canvas.grid} 0 L 0 0 0 ${canvas.grid}`}
            fill="none"
            stroke={EDGE_COLOUR}
            strokeWidth="0.5"
            opacity="0.22"
          />
        </pattern>
        <marker
          id="diagram-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOUR} />
        </marker>
      </defs>

      {canvas.showGrid ? (
        <rect
          className={styles.grid}
          width={extent.width}
          height={extent.height}
          fill={`url(#${gridId})`}
        />
      ) : null}

      <g className={styles.edges}>
        {model.edges.map((edge, index) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const start = borderPoint(from.geometry, centreOf(to.geometry));
          const end = borderPoint(to.geometry, centreOf(from.geometry));
          const chosen =
            selection?.kind === "edge" && selection.index === index;
          const dashed = edge.kind === "dotted";

          return (
            <g
              key={`${edge.from}-${edge.to}-${index}`}
              className={chosen ? styles.edgeChosen : undefined}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect({ kind: "edge", index });
              }}
            >
              {/* A wide invisible line, so a thin arrow is still easy to hit. */}
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="transparent"
                strokeWidth={14}
              />
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={edge.style?.stroke ?? EDGE_COLOUR}
                strokeWidth={
                  edge.style?.strokeWidth ?? (edge.kind === "thick" ? 3 : 1.5)
                }
                strokeDasharray={dashed ? "6 5" : undefined}
                markerEnd={
                  edge.kind === "open" ? undefined : "url(#diagram-arrow)"
                }
              />
              {edge.label ? (
                <text
                  className={styles.edgeLabel}
                  x={(start.x + end.x) / 2}
                  y={(start.y + end.y) / 2 - 6}
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {drag?.mode === "connect" ? (
          <line
            className={styles.pendingEdge}
            x1={centreOf(drag.geometry).x}
            y1={centreOf(drag.geometry).y}
            x2={drag.at.x}
            y2={drag.at.y}
            markerEnd="url(#diagram-arrow)"
          />
        ) : null}
      </g>

      {placed.map((node) => {
        const style = { ...emptyStyle, ...node.style };
        const colours = findClass(node.className);
        const fill = style.fill ?? colours?.fill ?? FALLBACK.fill;
        const stroke = style.stroke ?? colours?.stroke ?? FALLBACK.stroke;
        const text = style.text ?? colours?.text ?? FALLBACK.text;
        const fontSize = style.fontSize ?? 14;
        const chosen = selection?.kind === "node" && selection.id === node.id;
        const { x, y, width, height } = node.geometry;
        const glyphSize = Math.min(22, Math.max(14, height * 0.28));
        const hasGlyph = Boolean(findGlyph(node.glyph));
        const lines = wrap(node.label, width - 16, fontSize);
        // The mark sits above the words, so neither crowds the other.
        const textCentre = y + height / 2 + (hasGlyph ? glyphSize * 0.45 : 0);

        return (
          <g
            key={node.id}
            className={`${styles.node} ${chosen ? styles.nodeChosen : ""}`}
            onPointerDown={(event) => startDrag(event, "move", node)}
          >
            <ShapeOutline
              node={node}
              geometry={node.geometry}
              fill={fill}
              stroke={stroke}
              strokeWidth={style.strokeWidth ?? 1.5}
              dashed={style.dashed}
            />
            {hasGlyph ? (
              <GlyphMark
                name={node.glyph!}
                x={x + width / 2 - glyphSize / 2}
                y={y + height / 2 - glyphSize - lines.length * fontSize * 0.34}
                size={glyphSize}
                colour={text}
              />
            ) : null}
            <text
              x={x + width / 2}
              y={textCentre - ((lines.length - 1) * fontSize * 1.25) / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={text}
              fontSize={fontSize}
              pointerEvents="none"
            >
              {lines.map((line, index) => (
                <tspan
                  key={line + index}
                  x={x + width / 2}
                  dy={index === 0 ? 0 : fontSize * 1.25}
                >
                  {line}
                </tspan>
              ))}
            </text>

            {chosen && !readOnly ? (
              <>
                <rect
                  className={styles.selectionRing}
                  x={x - 4}
                  y={y - 4}
                  width={width + 8}
                  height={height + 8}
                  pointerEvents="none"
                />
                {/* Bottom-right: resize. Right-middle: draw a connection. */}
                <rect
                  className={styles.handle}
                  x={x + width - HANDLE / 2}
                  y={y + height - HANDLE / 2}
                  width={HANDLE}
                  height={HANDLE}
                  onPointerDown={(event) => startDrag(event, "resize", node)}
                />
                <circle
                  className={styles.port}
                  cx={x + width}
                  cy={y + height / 2}
                  r={HANDLE / 2 + 1}
                  onPointerDown={(event) => startDrag(event, "connect", node)}
                />
              </>
            ) : null}

            {drag?.mode === "connect" && drag.over === node.id ? (
              <rect
                className={styles.dropTarget}
                x={x - 4}
                y={y - 4}
                width={width + 8}
                height={height + 8}
                pointerEvents="none"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
