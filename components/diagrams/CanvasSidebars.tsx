"use client";

import { freeSpot } from "@/lib/diagrams/layout";
import {
  DIAGRAM_DIRECTIONS,
  EDGE_KINDS,
  NODE_SHAPES,
  defaultCanvas,
  defaultSize,
  directionLabels,
  emptyStyle,
  nextNodeId,
  renameNode,
  type DiagramModel,
  type EdgeKind,
  type NodeShape,
  type ShapeStyle,
} from "@/lib/diagrams/model";
import { GLYPHS, findGlyph } from "@/lib/diagrams/glyphs";
import { DIAGRAM_CLASSES, isHexColour } from "@/lib/diagrams/palette";

import type { Selection } from "./DiagramCanvas";
import styles from "./Diagrams.module.css";

/** A small drawing of each shape, so the palette shows what it makes. */
function ShapeIcon({ shape }: { shape: NodeShape }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 };
  return (
    <svg viewBox="0 0 40 28" aria-hidden="true" className={styles.shapeIcon}>
      {shape === "circle" ? (
        <ellipse cx="20" cy="14" rx="12" ry="12" {...common} />
      ) : shape === "diamond" ? (
        <polygon points="20,2 38,14 20,26 2,14" {...common} />
      ) : shape === "hexagon" ? (
        <polygon points="10,2 30,2 38,14 30,26 10,26 2,14" {...common} />
      ) : shape === "cylinder" ? (
        <g {...common}>
          <path d="M4 7 A16 5 0 0 1 36 7 L36 21 A16 5 0 0 1 4 21 Z" />
          <path d="M4 7 A16 5 0 0 0 36 7" />
        </g>
      ) : shape === "stadium" ? (
        <rect x="2" y="4" width="36" height="20" rx="10" {...common} />
      ) : shape === "rounded" ? (
        <rect x="2" y="4" width="36" height="20" rx="6" {...common} />
      ) : shape === "subroutine" ? (
        <g {...common}>
          <rect x="2" y="4" width="36" height="20" />
          <line x1="8" y1="4" x2="8" y2="24" />
          <line x1="32" y1="4" x2="32" y2="24" />
        </g>
      ) : (
        <rect x="2" y="4" width="36" height="20" {...common} />
      )}
    </svg>
  );
}

function GlyphIcon({ name }: { name: string }) {
  const glyph = findGlyph(name);
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={styles.shapeIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
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
          fill={dot.filled ? "currentColor" : "none"}
        />
      ))}
    </svg>
  );
}

/** Shapes to add. Clicking places one; it can then be dragged anywhere. */
export function ShapePalette({
  model,
  onChange,
  onSelect,
}: {
  model: DiagramModel;
  onChange: (model: DiagramModel) => void;
  onSelect: (selection: Selection) => void;
}) {
  function add(shape: NodeShape, glyph?: string, label?: string) {
    const size = defaultSize(shape);
    const name = label ?? NODE_SHAPES[shape].label;
    const id = nextNodeId(model, name);
    onChange({
      ...model,
      nodes: [
        ...model.nodes,
        {
          id,
          label: name,
          shape,
          className: null,
          glyph: glyph ?? null,
          geometry: { ...freeSpot(model), ...size },
          style: { ...emptyStyle },
        },
      ],
    });
    onSelect({ kind: "node", id });
  }

  return (
    <aside className={styles.rail} aria-label="Shapes">
      <h3>Shapes</h3>
      <div className={styles.shapeGrid}>
        {(Object.keys(NODE_SHAPES) as NodeShape[]).map((shape) => (
          <button
            key={shape}
            type="button"
            className={styles.shapeButton}
            onClick={() => add(shape)}
          >
            <ShapeIcon shape={shape} />
            <span>{NODE_SHAPES[shape].label}</span>
          </button>
        ))}
      </div>
      <h3>Pipeline</h3>
      <p className={styles.hint}>
        Boxes for the parts a research pipeline is made of. The mark is drawn on
        the canvas and travels into an image or a PDF; Mermaid on its own keeps
        the shape and the words.
      </p>
      <div className={styles.shapeGrid}>
        {GLYPHS.map((glyph) => (
          <button
            key={glyph.name}
            type="button"
            className={styles.shapeButton}
            onClick={() => add("rounded", glyph.name, glyph.suggests)}
          >
            <GlyphIcon name={glyph.name} />
            <span>{glyph.label}</span>
          </button>
        ))}
      </div>

      <p className={styles.hint}>
        Add a shape, then drag it. Drag the dot on its right edge onto another
        shape to join them.
      </p>
    </aside>
  );
}

function ColourField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.colourField}>
        <input
          id={id}
          type="color"
          value={isHexColour(value) ? value : "#1b2340"}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.quietButton}
          onClick={() => onChange(null)}
          disabled={value === null}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(
            event.target.value === "" || !Number.isFinite(next) ? null : next,
          );
        }}
      />
    </div>
  );
}

/** Everything about the selection, or about the diagram when nothing is chosen. */
export function StylePanel({
  model,
  selection,
  onChange,
  onSelect,
}: {
  model: DiagramModel;
  selection: Selection;
  onChange: (model: DiagramModel) => void;
  onSelect: (selection: Selection) => void;
}) {
  const canvas = model.canvas ?? defaultCanvas;

  const setCanvas = (patch: Partial<typeof canvas>) =>
    onChange({ ...model, canvas: { ...canvas, ...patch } });

  if (selection?.kind === "node") {
    const node = model.nodes.find((candidate) => candidate.id === selection.id);
    if (!node) return null;
    const style: ShapeStyle = { ...emptyStyle, ...node.style };

    const patch = (changes: Partial<typeof node>) =>
      onChange({
        ...model,
        nodes: model.nodes.map((candidate) =>
          candidate.id === node.id ? { ...candidate, ...changes } : candidate,
        ),
      });
    const patchStyle = (changes: Partial<ShapeStyle>) =>
      patch({ style: { ...style, ...changes } });

    return (
      <aside className={styles.rail} aria-label="Shape style">
        <h3>Shape</h3>

        <div className={styles.field}>
          <label htmlFor="style-label">Text</label>
          <input
            id="style-label"
            value={node.label}
            maxLength={160}
            onChange={(event) => patch({ label: event.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="style-id">Identifier</label>
          <input
            id="style-id"
            defaultValue={node.id}
            maxLength={64}
            key={node.id}
            onBlur={(event) => {
              const next = renameNode(model, node.id, event.target.value);
              if (next === model) event.target.value = node.id;
              else {
                onChange(next);
                onSelect({ kind: "node", id: event.target.value });
              }
            }}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="style-shape">Shape</label>
          <select
            id="style-shape"
            value={node.shape}
            onChange={(event) =>
              patch({ shape: event.target.value as NodeShape })
            }
          >
            {Object.entries(NODE_SHAPES).map(([value, shape]) => (
              <option key={value} value={value}>
                {shape.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="style-glyph">Icon</label>
          <select
            id="style-glyph"
            value={node.glyph ?? ""}
            onChange={(event) => patch({ glyph: event.target.value || null })}
          >
            <option value="">None</option>
            {GLYPHS.map((glyph) => (
              <option key={glyph.name} value={glyph.name}>
                {glyph.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="style-class">Palette colour</label>
          <select
            id="style-class"
            value={node.className ?? ""}
            onChange={(event) =>
              patch({ className: event.target.value || null })
            }
          >
            <option value="">None</option>
            {DIAGRAM_CLASSES.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <ColourField
          id="style-fill"
          label="Fill"
          value={style.fill}
          onChange={(value) => patchStyle({ fill: value })}
        />
        <ColourField
          id="style-stroke"
          label="Line"
          value={style.stroke}
          onChange={(value) => patchStyle({ stroke: value })}
        />
        <ColourField
          id="style-text"
          label="Text colour"
          value={style.text}
          onChange={(value) => patchStyle({ text: value })}
        />

        <div className={styles.fieldPair}>
          <NumberField
            id="style-stroke-width"
            label="Line width"
            value={style.strokeWidth}
            min={1}
            max={12}
            onChange={(value) => patchStyle({ strokeWidth: value })}
          />
          <NumberField
            id="style-font-size"
            label="Text size"
            value={style.fontSize}
            min={8}
            max={48}
            onChange={(value) => patchStyle({ fontSize: value })}
          />
        </div>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={style.dashed}
            onChange={(event) => patchStyle({ dashed: event.target.checked })}
          />
          <span>Dashed line</span>
        </label>

        {node.geometry ? (
          <div className={styles.fieldPair}>
            <NumberField
              id="style-width"
              label="Width"
              value={node.geometry.width}
              min={40}
              max={1200}
              onChange={(value) =>
                patch({
                  geometry: { ...node.geometry!, width: value ?? 160 },
                })
              }
            />
            <NumberField
              id="style-height"
              label="Height"
              value={node.geometry.height}
              min={30}
              max={800}
              onChange={(value) =>
                patch({
                  geometry: { ...node.geometry!, height: value ?? 70 },
                })
              }
            />
          </div>
        ) : null}

        <button
          type="button"
          className={styles.quietButton}
          onClick={() => {
            onChange({
              ...model,
              nodes: model.nodes.filter((c) => c.id !== node.id),
              edges: model.edges.filter(
                (edge) => edge.from !== node.id && edge.to !== node.id,
              ),
            });
            onSelect(null);
          }}
        >
          Remove this shape
        </button>
      </aside>
    );
  }

  if (selection?.kind === "edge") {
    const edge = model.edges[selection.index];
    if (!edge) return null;
    const patch = (changes: Partial<typeof edge>) =>
      onChange({
        ...model,
        edges: model.edges.map((candidate, index) =>
          index === selection.index ? { ...candidate, ...changes } : candidate,
        ),
      });

    return (
      <aside className={styles.rail} aria-label="Connection style">
        <h3>Connection</h3>
        <div className={styles.field}>
          <label htmlFor="edge-label">Label</label>
          <input
            id="edge-label"
            value={edge.label ?? ""}
            maxLength={120}
            onChange={(event) => patch({ label: event.target.value || null })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="edge-kind">Line</label>
          <select
            id="edge-kind"
            value={edge.kind}
            onChange={(event) =>
              patch({ kind: event.target.value as EdgeKind })
            }
          >
            {Object.entries(EDGE_KINDS).map(([value, kind]) => (
              <option key={value} value={value}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>
        <ColourField
          id="edge-colour"
          label="Colour"
          value={edge.style?.stroke ?? null}
          onChange={(value) =>
            patch({
              style: {
                stroke: value,
                strokeWidth: edge.style?.strokeWidth ?? null,
              },
            })
          }
        />
        <NumberField
          id="edge-width"
          label="Line width"
          value={edge.style?.strokeWidth ?? null}
          min={1}
          max={12}
          onChange={(value) =>
            patch({
              style: { stroke: edge.style?.stroke ?? null, strokeWidth: value },
            })
          }
        />
        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.quietButton}
            onClick={() => patch({ from: edge.to, to: edge.from })}
          >
            Reverse
          </button>
          <button
            type="button"
            className={styles.quietButton}
            onClick={() => {
              onChange({
                ...model,
                edges: model.edges.filter((_, i) => i !== selection.index),
              });
              onSelect(null);
            }}
          >
            Remove
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.rail} aria-label="Diagram settings">
      <h3>Diagram</h3>
      <div className={styles.field}>
        <label htmlFor="canvas-direction">Layout direction</label>
        <select
          id="canvas-direction"
          value={model.direction}
          onChange={(event) =>
            onChange({
              ...model,
              direction: event.target.value as DiagramModel["direction"],
            })
          }
        >
          {DIAGRAM_DIRECTIONS.map((value) => (
            <option key={value} value={value}>
              {directionLabels[value]}
            </option>
          ))}
        </select>
        <p className={styles.hint}>
          Used when a diagram is laid out, and written into the Mermaid.
        </p>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={canvas.showGrid}
          onChange={(event) => setCanvas({ showGrid: event.target.checked })}
        />
        <span>Show the grid</span>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={canvas.snap}
          onChange={(event) => setCanvas({ snap: event.target.checked })}
        />
        <span>Snap to the grid</span>
      </label>
      <NumberField
        id="canvas-grid"
        label="Grid size"
        value={canvas.grid}
        min={4}
        max={80}
        onChange={(value) => setCanvas({ grid: value ?? 10 })}
      />
      <p className={styles.hint}>
        Choose a shape or a connection to change how it looks.
      </p>
    </aside>
  );
}
