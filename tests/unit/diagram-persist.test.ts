import { describe, expect, it } from "vitest";

import { applyStoredLayout, toStoredLayout } from "@/lib/diagrams/persist";
import { parseFlowchart } from "@/lib/diagrams/mermaid-source";
import { emptyStyle, type DiagramModel } from "@/lib/diagrams/model";

const base = parseFlowchart(`flowchart TD
  a["A"] --> b["B"]
`).model;

const placed: DiagramModel = {
  ...base,
  canvas: { grid: 20, showGrid: false, snap: false },
  nodes: base.nodes.map((node, index) => ({
    ...node,
    glyph: index === 0 ? "image" : null,
    geometry: { x: index * 200, y: 40, width: 160, height: 70 },
    style: { ...emptyStyle, fill: "#4b9c8a", fontSize: 18, dashed: true },
  })),
  edges: base.edges.map((edge) => ({
    ...edge,
    style: { stroke: "#c98f4b", strokeWidth: 3 },
  })),
};

describe("storing a canvas beside the source", () => {
  it("comes back exactly as it went in", () => {
    const restored = applyStoredLayout(base, toStoredLayout(placed));
    expect(restored.canvas).toEqual(placed.canvas);
    expect(restored.nodes[0]!.geometry).toEqual({
      x: 0,
      y: 40,
      width: 160,
      height: 70,
    });
    expect(restored.nodes[0]!.glyph).toBe("image");
    expect(restored.nodes[0]!.style).toMatchObject({
      fill: "#4b9c8a",
      fontSize: 18,
      dashed: true,
    });
    expect(restored.edges[0]!.style).toEqual({
      stroke: "#c98f4b",
      strokeWidth: 3,
    });
  });

  /**
   * The source decides what exists. A box deleted from the text must not come
   * back because its position is still stored, and a box added to the text
   * simply has no position yet.
   */
  it("lets the source decide what exists, not the stored layout", () => {
    const stored = toStoredLayout(placed);
    const changed = parseFlowchart(`flowchart TD
  a["A"] --> c["C"]
`).model;
    const restored = applyStoredLayout(changed, stored);

    expect(restored.nodes.map((node) => node.id)).toEqual(["a", "c"]);
    expect(restored.nodes[0]!.geometry).toBeDefined();
    expect(restored.nodes[1]!.geometry).toBeUndefined();
  });

  it("refuses stored values it cannot trust", () => {
    const restored = applyStoredLayout(base, {
      version: 1,
      canvas: { grid: 9999, showGrid: "yes", snap: 1 },
      nodes: {
        a: {
          geometry: { x: -50, y: "high", width: 1e9, height: 70 },
          style: { fill: "javascript:alert(1)", fontSize: 900, dashed: "no" },
          glyph: "../../etc/passwd",
        },
      },
      edges: [{ stroke: "red", strokeWidth: 500 }],
    });

    // A geometry with an unusable value is dropped whole, not half-applied.
    expect(restored.nodes[0]!.geometry).toBeUndefined();
    expect(restored.nodes[0]!.style?.fill).toBeNull();
    expect(restored.nodes[0]!.style?.fontSize).toBe(48);
    expect(restored.nodes[0]!.style?.dashed).toBe(false);
    expect(restored.nodes[0]!.glyph).toBeNull();
    expect(restored.canvas!.grid).toBe(80);
    expect(restored.edges[0]!.style).toEqual({ stroke: null, strokeWidth: 12 });
  });

  it("shrugs at nonsense instead of failing", () => {
    for (const stored of [null, undefined, "", 42, []]) {
      expect(() => applyStoredLayout(base, stored)).not.toThrow();
    }
    expect(applyStoredLayout(base, null)).toBe(base);
  });
});
