import { describe, expect, it } from "vitest";

import {
  allocateLanes,
  fitText,
  layerOrder,
  layoutGraph,
  orderLayers,
  placeFocusLabel,
  type GraphLayout,
  type LaidOutNode,
} from "@/components/graph/graph-layout";
import type { GraphEdge, GraphNode } from "@/lib/graph-types";

const measure = (text: string) => text.length * 8;

function node(kind: GraphNode["kind"], slug: string, label = slug): GraphNode {
  return {
    id: `${kind}:${slug}`,
    kind,
    label,
    description: "",
    href: `/research/${slug}`,
    themeSlugs: ["fixture"],
  };
}

function edge(
  source: GraphNode,
  target: GraphNode,
  relationship: GraphEdge["relationship"] = "contains",
): GraphEdge {
  return {
    id: `${source.id}->${target.id}`,
    source: source.id,
    target: target.id,
    relationship,
  };
}

function fixtureGraph() {
  const themes = ["Perception", "Language", "Junction", "Understanding"].map(
    (name) => node("theme", name.toLowerCase(), name),
  );
  const areas = [
    "Computer Vision",
    "Language Models & NLP",
    "Vision-Language Models",
    "Multimodal AI",
    "Representation Learning",
    "Causal Inference",
  ].map((name, index) => node("area", `area-${index}`, name));
  const projects = [0, 1, 2, 3].map((index) =>
    node(
      "project",
      `project-${index}`,
      `A deliberately long project title for layout checks ${index}`,
    ),
  );
  const people = [0, 1, 2, 3, 4].map((index) =>
    node("person", `person-${index}`, `Researcher ${index}`),
  );
  const publications = [0, 1, 2, 3, 4].map((index) =>
    node("publication", `publication-${index}`, `Publication ${index}`),
  );

  const edges = [
    ...areas.map((area, index) =>
      edge(themes[Math.min(index, themes.length - 1)]!, area),
    ),
    ...projects.map((project, index) =>
      edge(areas[(index * 2) % areas.length]!, project, "studies"),
    ),
    ...people.map((person, index) =>
      edge(projects[index % projects.length]!, person, "works-on"),
    ),
    // Stored in the reverse direction to prove orientation is normalised.
    ...publications.map((publication, index) =>
      edge(publication, people[index]!, "authored"),
    ),
    edge(areas[0]!, publications[4]!, "produced"),
  ];

  return {
    nodes: [...themes, ...areas, ...projects, ...people, ...publications],
    edges,
  };
}

function labelBox(placed: LaidOutNode) {
  const width = measure(placed.label ?? "");
  const anchorX = placed.x + placed.labelDx;
  if (placed.labelAnchor === "start") {
    return { left: anchorX, right: anchorX + width };
  }
  if (placed.labelAnchor === "end") {
    return { left: anchorX - width, right: anchorX };
  }
  return { left: anchorX - width / 2, right: anchorX + width / 2 };
}

function columnsOf(layout: GraphLayout): LaidOutNode[][] {
  return layout.layers.map((ids) => ids.map((id) => layout.nodes.get(id)!));
}

describe("connections map layout", () => {
  const graph = fixtureGraph();

  it("places every layer in one aligned column, in network order", () => {
    for (const width of [320, 390, 640, 896, 1280]) {
      const layout = layoutGraph(graph.nodes, graph.edges, width, measure);
      const columns = columnsOf(layout);

      expect(columns).toHaveLength(layerOrder.length);
      columns.forEach((column, index) => {
        expect(new Set(column.map((placed) => placed.x)).size).toBe(1);
        if (index > 0) {
          expect(column[0]!.x).toBeGreaterThan(columns[index - 1]![0]!.x);
        }
        for (const placed of column) {
          expect(placed.y).toBeGreaterThan(0);
          expect(placed.y).toBeLessThan(layout.height);
        }
      });
    }
  });

  it("keeps every visible label inside the drawing and its own lane", () => {
    for (const width of [320, 390, 640, 896, 1280]) {
      const layout = layoutGraph(graph.nodes, graph.edges, width, measure);
      const boxes = columnsOf(layout).map((column) =>
        column.filter((placed) => placed.label).map(labelBox),
      );

      boxes.flat().forEach((box) => {
        expect(box.left).toBeGreaterThanOrEqual(7.99);
        expect(box.right).toBeLessThanOrEqual(width - 7.99);
      });

      for (let left = 0; left < boxes.length; left += 1) {
        for (let right = left + 1; right < boxes.length; right += 1) {
          if (!boxes[left]!.length || !boxes[right]!.length) continue;
          const leftEdge = Math.max(...boxes[left]!.map((box) => box.right));
          const rightEdge = Math.min(...boxes[right]!.map((box) => box.left));
          expect(leftEdge).toBeLessThanOrEqual(rightEdge + 0.01);
        }
      }

      const rows = new Map<number, { left: number; right: number }[]>();
      for (const heading of layout.headings) {
        const headingWidth = measure(heading.text);
        const left =
          heading.anchor === "start"
            ? heading.x
            : heading.anchor === "end"
              ? heading.x - headingWidth
              : heading.x - headingWidth / 2;
        rows.set(heading.y, [
          ...(rows.get(heading.y) ?? []),
          { left, right: left + headingWidth },
        ]);
      }
      for (const row of rows.values()) {
        row.forEach((box, index) => {
          expect(box.left).toBeGreaterThanOrEqual(7.99);
          expect(box.right).toBeLessThanOrEqual(width - 7.99);
          if (index > 0) {
            expect(row[index - 1]!.right).toBeLessThanOrEqual(box.left);
          }
        });
      }
    }
  });

  it("names people and publications on focus only and fits long names", () => {
    const wide = layoutGraph(graph.nodes, graph.edges, 1280, measure);
    const labelsByKind = (kind: GraphNode["kind"]) =>
      graph.nodes
        .filter((candidate) => candidate.kind === kind)
        .map((candidate) => wide.nodes.get(candidate.id)!.label);

    expect(labelsByKind("theme").every(Boolean)).toBe(true);
    expect(labelsByKind("area").every(Boolean)).toBe(true);
    expect(labelsByKind("person").every((label) => label === null)).toBe(true);
    expect(labelsByKind("publication").every((label) => label === null)).toBe(
      true,
    );
    expect(labelsByKind("project").every((label) => label?.endsWith("…"))).toBe(
      true,
    );

    const narrow = layoutGraph(graph.nodes, graph.edges, 390, measure);
    expect(
      graph.nodes
        .filter((candidate) => candidate.kind === "area")
        .every((candidate) => narrow.nodes.get(candidate.id)!.label === null),
    ).toBe(true);
  });

  it("gives a sparse two-layer map room for full theme and area names", () => {
    const sparse = graph.nodes.filter((candidate) =>
      ["theme", "area"].includes(candidate.kind),
    );
    const ids = new Set(sparse.map((candidate) => candidate.id));
    const layout = layoutGraph(
      sparse,
      graph.edges.filter(
        (candidate) => ids.has(candidate.source) && ids.has(candidate.target),
      ),
      350,
      measure,
    );

    for (const candidate of sparse) {
      expect(layout.nodes.get(candidate.id)!.label).toBe(candidate.label);
    }
  });

  it("orders a layer by its connections to remove crossings", () => {
    const first = node("theme", "first");
    const second = node("theme", "second");
    const secondArea = node("area", "second-area");
    const firstArea = node("area", "first-area");

    expect(
      orderLayers(
        [first, second, secondArea, firstArea],
        [edge(first, firstArea), edge(second, secondArea)],
        ["theme", "area"],
        640,
      ),
    ).toEqual([
      [first.id, second.id],
      [firstArea.id, secondArea.id],
    ]);
  });

  it("orients every edge from the earlier layer", () => {
    const layout = layoutGraph(graph.nodes, graph.edges, 896, measure);

    expect(layout.edges).toHaveLength(graph.edges.length);
    for (const laidOut of layout.edges) {
      expect(laidOut.fromLayer).toBeLessThanOrEqual(laidOut.toLayer);
      expect(layout.nodes.get(laidOut.from)!.layer).toBe(laidOut.fromLayer);
      expect(laidOut.path).toMatch(/^M [\d.]+ [\d.]+ C /u);
    }
  });

  it("fits text with an ellipsis and keeps focus labels inside the drawing", () => {
    expect(fitText("Short", 80, measure)).toBe("Short");
    const fitted = fitText("Language Models & NLP", 80, measure);
    expect(fitted.endsWith("…")).toBe(true);
    expect(measure(fitted)).toBeLessThanOrEqual(80);
    expect(fitText("Language", 4, measure)).toBe("");

    const base: LaidOutNode = {
      id: "publication:edge",
      layer: 4,
      x: 12,
      y: 200,
      radius: 6,
      label: null,
      labelPlacement: "above",
      labelAnchor: "end",
      labelDx: 6,
      labelDy: -15,
    };
    expect(placeFocusLabel(base, "A long title", 400, measure)).toMatchObject({
      x: 8,
      anchor: "start",
    });
    expect(
      placeFocusLabel({ ...base, x: 392 }, "A long title", 400, measure),
    ).toMatchObject({ x: 392, anchor: "end" });
    expect(
      placeFocusLabel(
        { ...base, x: 120, labelPlacement: "side", labelDx: -16, labelDy: 4.5 },
        "Understanding and beyond",
        400,
        measure,
      ),
    ).toMatchObject({ x: 104, y: 204.5, anchor: "end", text: "Understandi…" });
    const clipped = placeFocusLabel(
      { ...base, x: 200 },
      "x".repeat(120),
      400,
      measure,
    );
    expect(measure(clipped.text)).toBeLessThanOrEqual(384);
  });

  it("names outer columns beside their nodes from the content edge on wide screens", () => {
    const sparse = graph.nodes.filter((candidate) =>
      ["theme", "area"].includes(candidate.kind),
    );
    const ids = new Set(sparse.map((candidate) => candidate.id));
    const sparseEdges = graph.edges.filter(
      (candidate) => ids.has(candidate.source) && ids.has(candidate.target),
    );
    const layout = layoutGraph(sparse, sparseEdges, 896, measure);
    const [themes, areas] = columnsOf(layout);

    expect(themes!.every((placed) => placed.labelPlacement === "side")).toBe(
      true,
    );
    expect(themes!.every((placed) => placed.labelAnchor === "end")).toBe(true);
    expect(areas!.every((placed) => placed.labelAnchor === "start")).toBe(true);
    expect(themes!.map((placed) => placed.label)).toEqual(
      themes!.map(
        (placed) => graph.nodes.find((n) => n.id === placed.id)!.label,
      ),
    );

    const widestTheme = Math.max(
      ...themes!.map((placed) => measure(placed.label!)),
    );
    // The widest theme name starts at the content edge.
    expect(themes![0]!.x + themes![0]!.labelDx - widestTheme).toBeCloseTo(8, 0);
    expect(areas![0]!.x - themes![0]!.x).toBeLessThanOrEqual(300);

    // Extra width never stretches the edges.
    const wide = layoutGraph(sparse, sparseEdges, 2400, measure);
    const [wideThemes, wideAreas] = columnsOf(wide);
    expect(wideAreas![0]!.x - wideThemes![0]!.x).toBe(300);

    // At its natural width the network fits exactly, with the readable gap.
    const natural = layoutGraph(
      sparse,
      sparseEdges,
      layout.naturalWidth,
      measure,
    );
    const [naturalThemes, naturalAreas] = columnsOf(natural);
    expect(naturalAreas![0]!.x - naturalThemes![0]!.x).toBeCloseTo(300, 0);
    const widestArea = Math.max(
      ...naturalAreas!.map((placed) => measure(placed.label!)),
    );
    expect(
      naturalAreas![0]!.x + naturalAreas![0]!.labelDx + widestArea,
    ).toBeLessThanOrEqual(layout.naturalWidth - 32);
    expect(layoutGraph(sparse, sparseEdges, 390, measure).naturalWidth).toBe(
      layout.naturalWidth,
    );
  });

  it("levels each node with its connections and keeps rows apart", () => {
    const layout = layoutGraph(graph.nodes, graph.edges, 1280, measure);
    const neighbours = new Map<string, string[]>();
    for (const candidate of graph.edges) {
      neighbours.set(candidate.source, [
        ...(neighbours.get(candidate.source) ?? []),
        candidate.target,
      ]);
      neighbours.set(candidate.target, [
        ...(neighbours.get(candidate.target) ?? []),
        candidate.source,
      ]);
    }

    // "Perception" contains one area, so its edge runs level.
    const perception = layout.nodes.get("theme:perception")!;
    const [onlyArea] = neighbours.get("theme:perception")!;
    expect(perception.y).toBeCloseTo(layout.nodes.get(onlyArea!)!.y, 0);

    for (const column of columnsOf(layout)) {
      column.slice(1).forEach((placed, index) => {
        expect(placed.y - column[index]!.y).toBeGreaterThanOrEqual(55.9);
      });
    }
  });

  it("keeps every node inside the drawing when connections cluster at the extremes", () => {
    const themes = [node("theme", "only", "Only")];
    const areas = Array.from({ length: 8 }, (_, index) =>
      node("area", `area-${index}`, `Area ${index}`),
    );
    const people = Array.from({ length: 7 }, (_, index) =>
      node("person", `person-${index}`, `Person ${index}`),
    );
    const edges = [
      ...areas.map((area) => edge(themes[0]!, area)),
      // Five people pull towards the top area, two towards the bottom one.
      ...people.map((person, index) =>
        edge(areas[index < 5 ? 0 : 7]!, person, "researches"),
      ),
    ];
    const layout = layoutGraph(
      [...themes, ...areas, ...people],
      edges,
      1280,
      measure,
    );

    for (const placed of layout.nodes.values()) {
      expect(placed.y).toBeGreaterThanOrEqual(92 - 0.05);
      expect(placed.y).toBeLessThanOrEqual(layout.height - 36 + 0.05);
    }
    for (const column of columnsOf(layout)) {
      column.slice(1).forEach((placed, index) => {
        expect(placed.y - column[index]!.y).toBeGreaterThanOrEqual(55.9);
      });
    }
  });

  it("offers a narrow label's unused room to its neighbour", () => {
    const [short, long] = allocateLanes(
      [
        { point: 100, anchor: "middle", width: 20 },
        { point: 300, anchor: "middle", width: 300 },
      ],
      1000,
    );

    expect(short).toBe(20);
    // An even split of the 184px gap would allow the long label only 184px.
    expect(long).toBe(300);
  });
});
