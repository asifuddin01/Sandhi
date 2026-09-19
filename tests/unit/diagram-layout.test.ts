import { describe, expect, it } from "vitest";

import {
  borderPoint,
  canvasExtent,
  freeSpot,
  layoutModel,
  rankNodes,
} from "@/lib/diagrams/layout";
import { parseFlowchart } from "@/lib/diagrams/mermaid-source";
import { snapTo, type DiagramModel } from "@/lib/diagrams/model";

const chain = parseFlowchart(`flowchart TD
  a["A"] --> b["B"]
  b --> c["C"]
  a --> c
`).model;

describe("rankNodes", () => {
  it("puts a box after everything that feeds it", () => {
    const rank = rankNodes(chain);
    expect(rank.get("a")).toBe(0);
    expect(rank.get("b")).toBe(1);
    // C is fed by both, so it sits after the later of them.
    expect(rank.get("c")).toBe(2);
  });

  it("does not hang on a cycle", () => {
    const cyclic = parseFlowchart(`flowchart TD
  a["A"] --> b["B"]
  b --> a
`).model;
    expect(() => rankNodes(cyclic)).not.toThrow();
    expect(rankNodes(cyclic).size).toBe(2);
  });

  it("ignores a box that points at itself", () => {
    const loop = parseFlowchart(`flowchart TD
  a["A"] --> a
`).model;
    expect(rankNodes(loop).get("a")).toBe(0);
  });
});

describe("layoutModel", () => {
  it("gives every box a position, in reading order", () => {
    const laid = layoutModel(chain);
    const at = (id: string) =>
      laid.nodes.find((node) => node.id === id)!.geometry!;

    expect(laid.nodes.every((node) => node.geometry)).toBe(true);
    expect(at("a").y).toBeLessThan(at("b").y);
    expect(at("b").y).toBeLessThan(at("c").y);
  });

  it("lays a left-to-right diagram across instead of down", () => {
    const across = layoutModel({ ...chain, direction: "LR" });
    const at = (id: string) =>
      across.nodes.find((node) => node.id === id)!.geometry!;
    expect(at("a").x).toBeLessThan(at("b").x);
    expect(at("a").y).toBe(at("b").y);
  });

  it("reverses a bottom-to-top diagram", () => {
    const up = layoutModel({ ...chain, direction: "BT" });
    const at = (id: string) =>
      up.nodes.find((node) => node.id === id)!.geometry!;
    expect(at("a").y).toBeGreaterThan(at("c").y);
  });

  it("leaves a box that was already placed exactly where it was", () => {
    const pinned: DiagramModel = {
      ...chain,
      nodes: chain.nodes.map((node) =>
        node.id === "b"
          ? { ...node, geometry: { x: 700, y: 12, width: 90, height: 40 } }
          : node,
      ),
    };
    const laid = layoutModel(pinned);
    expect(laid.nodes.find((node) => node.id === "b")!.geometry).toEqual({
      x: 700,
      y: 12,
      width: 90,
      height: 40,
    });
  });

  it("does nothing at all once everything is placed", () => {
    const laid = layoutModel(chain);
    expect(layoutModel(laid)).toBe(laid);
  });

  it("never overlaps two boxes in the same row", () => {
    const wide = layoutModel(
      parseFlowchart(`flowchart TD
  root["Root"] --> a["A"]
  root --> b["B"]
  root --> c["C"]
`).model,
    );
    const row = wide.nodes
      .filter((node) => node.id !== "root")
      .map((node) => node.geometry!)
      .sort((left, right) => left.x - right.x);
    for (let index = 1; index < row.length; index += 1) {
      expect(row[index]!.x).toBeGreaterThanOrEqual(
        row[index - 1]!.x + row[index - 1]!.width,
      );
    }
  });
});

describe("canvas geometry", () => {
  it("measures the area the boxes need", () => {
    const laid = layoutModel(chain);
    const extent = canvasExtent(laid);
    for (const node of laid.nodes) {
      expect(node.geometry!.x + node.geometry!.width).toBeLessThanOrEqual(
        extent.width,
      );
      expect(node.geometry!.y + node.geometry!.height).toBeLessThanOrEqual(
        extent.height,
      );
    }
  });

  it("stops an arrow at the edge of its box, not its middle", () => {
    const box = { x: 0, y: 0, width: 100, height: 50 };
    expect(borderPoint(box, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(borderPoint(box, { x: 50, y: -500 })).toEqual({ x: 50, y: 0 });
    // Straight out of a corner, it leaves through the nearer side.
    const corner = borderPoint(box, { x: 200, y: 150 });
    expect(corner.x).toBeLessThanOrEqual(100);
    expect(corner.y).toBeLessThanOrEqual(50);
  });

  it("puts a new box below what is already there", () => {
    const laid = layoutModel(chain);
    const spot = freeSpot(laid);
    const lowest = Math.max(
      ...laid.nodes.map((node) => node.geometry!.y + node.geometry!.height),
    );
    expect(spot.y).toBeGreaterThan(lowest);
  });
});

describe("snapTo", () => {
  it("snaps to the grid when asked, and rounds when not", () => {
    expect(snapTo(47, 10, true)).toBe(50);
    expect(snapTo(44, 10, true)).toBe(40);
    expect(snapTo(47.6, 10, false)).toBe(48);
    expect(snapTo(47, 0, true)).toBe(47);
  });
});
