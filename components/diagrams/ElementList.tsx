"use client";

import {
  EDGE_KINDS,
  NODE_SHAPES,
  moveNode,
  nextNodeId,
  removeNode,
  renameNode,
  type DiagramModel,
  type EdgeKind,
  type NodeShape,
} from "@/lib/diagrams/model";
import { DIAGRAM_CLASSES } from "@/lib/diagrams/palette";

import styles from "./Diagrams.module.css";

/**
 * Editing the diagram as a list of parts rather than by dragging. Every change
 * is made to the model and written straight back to the source, so the text
 * and the picture can never disagree, and the whole editor works from a
 * keyboard.
 */
export function ElementList({
  model,
  crops,
  onChange,
}: {
  model: DiagramModel;
  /** A crop of the original drawing per node, after an image import. */
  crops?: Record<string, string>;
  onChange: (next: DiagramModel) => void;
}) {
  const setNode = (id: string, patch: Partial<DiagramModel["nodes"][number]>) =>
    onChange({
      ...model,
      nodes: model.nodes.map((node) =>
        node.id === id ? { ...node, ...patch } : node,
      ),
    });

  const setEdge = (index: number, patch: Partial<DiagramModel["edges"][number]>) =>
    onChange({
      ...model,
      edges: model.edges.map((edge, at) =>
        at === index ? { ...edge, ...patch } : edge,
      ),
    });

  return (
    <div className={styles.elements}>
      <section aria-labelledby="diagram-boxes">
        <h3 id="diagram-boxes">Boxes</h3>
        {model.nodes.length === 0 ? (
          <p className={styles.hint}>No boxes yet.</p>
        ) : null}

        {model.nodes.map((node, index) => (
          <div className={styles.elementRow} key={node.id}>
            {crops?.[node.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.crop}
                src={crops[node.id]}
                alt={`How box ${index + 1} was drawn`}
              />
            ) : null}
            <div className={styles.field}>
              <label htmlFor={`node-label-${node.id}`}>
                Box {index + 1} name
              </label>
              <input
                id={`node-label-${node.id}`}
                value={node.label}
                maxLength={160}
                onChange={(event) =>
                  setNode(node.id, { label: event.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`node-id-${node.id}`}>Identifier</label>
              <input
                id={`node-id-${node.id}`}
                defaultValue={node.id}
                maxLength={64}
                onBlur={(event) => {
                  const next = renameNode(model, node.id, event.target.value);
                  if (next === model) event.target.value = node.id;
                  else onChange(next);
                }}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`node-shape-${node.id}`}>Shape</label>
              <select
                id={`node-shape-${node.id}`}
                value={node.shape}
                onChange={(event) =>
                  setNode(node.id, { shape: event.target.value as NodeShape })
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
              <label htmlFor={`node-colour-${node.id}`}>Colour</label>
              <select
                id={`node-colour-${node.id}`}
                value={node.className ?? ""}
                onChange={(event) =>
                  setNode(node.id, { className: event.target.value || null })
                }
              >
                <option value="">Default</option>
                {DIAGRAM_CLASSES.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.quietButton}
                disabled={index === 0}
                onClick={() => onChange(moveNode(model, node.id, -1))}
              >
                Up<span className="visually-hidden">: box {index + 1}</span>
              </button>
              <button
                type="button"
                className={styles.quietButton}
                disabled={index === model.nodes.length - 1}
                onClick={() => onChange(moveNode(model, node.id, 1))}
              >
                Down<span className="visually-hidden">: box {index + 1}</span>
              </button>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => onChange(removeNode(model, node.id))}
              >
                Remove<span className="visually-hidden"> box {index + 1}</span>
              </button>
            </div>
          </div>
        ))}

        <p>
          <button
            type="button"
            className={styles.quietButton}
            onClick={() => {
              const id = nextNodeId(model, "box");
              onChange({
                ...model,
                nodes: [
                  ...model.nodes,
                  {
                    id,
                    label: `Box ${model.nodes.length + 1}`,
                    shape: "rectangle",
                    className: null,
                  },
                ],
              });
            }}
          >
            Add a box
          </button>
        </p>
      </section>

      <section aria-labelledby="diagram-connections">
        <h3 id="diagram-connections">Connections</h3>
        {model.edges.length === 0 ? (
          <p className={styles.hint}>Nothing is joined up yet.</p>
        ) : null}

        {model.edges.map((edge, index) => (
          <div className={styles.elementRow} key={`${edge.from}-${edge.to}-${index}`}>
            <div className={styles.field}>
              <label htmlFor={`edge-from-${index}`}>From</label>
              <select
                id={`edge-from-${index}`}
                value={edge.from}
                onChange={(event) => setEdge(index, { from: event.target.value })}
              >
                {model.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={`edge-to-${index}`}>To</label>
              <select
                id={`edge-to-${index}`}
                value={edge.to}
                onChange={(event) => setEdge(index, { to: event.target.value })}
              >
                {model.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={`edge-label-${index}`}>Label</label>
              <input
                id={`edge-label-${index}`}
                value={edge.label ?? ""}
                maxLength={120}
                onChange={(event) =>
                  setEdge(index, { label: event.target.value || null })
                }
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`edge-kind-${index}`}>Line</label>
              <select
                id={`edge-kind-${index}`}
                value={edge.kind}
                onChange={(event) =>
                  setEdge(index, { kind: event.target.value as EdgeKind })
                }
              >
                {Object.entries(EDGE_KINDS).map(([value, kind]) => (
                  <option key={value} value={value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() =>
                  setEdge(index, { from: edge.to, to: edge.from })
                }
              >
                Reverse
                <span className="visually-hidden"> connection {index + 1}</span>
              </button>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() =>
                  onChange({
                    ...model,
                    edges: model.edges.filter((_, at) => at !== index),
                  })
                }
              >
                Remove
                <span className="visually-hidden"> connection {index + 1}</span>
              </button>
            </div>
          </div>
        ))}

        {model.nodes.length >= 2 ? (
          <p>
            <button
              type="button"
              className={styles.quietButton}
              onClick={() =>
                onChange({
                  ...model,
                  edges: [
                    ...model.edges,
                    {
                      from: model.nodes[0]!.id,
                      to: model.nodes[1]!.id,
                      label: null,
                      kind: "arrow",
                    },
                  ],
                })
              }
            >
              Add a connection
            </button>
          </p>
        ) : null}
      </section>
    </div>
  );
}
