import { describe, expect, it } from "vitest";

import {
  emptyModel,
  moveNode,
  nextNodeId,
  removeNode,
  renameNode,
  type DiagramModel,
} from "@/lib/diagrams/model";
import {
  parseFlowchart,
  quoteLabel,
  toMermaid,
} from "@/lib/diagrams/mermaid-source";

const source = `flowchart LR
  %% the edge of the system
  browser["Browser"] --> proxy(["Proxy"])
  proxy -->|"authorised"| api[["API"]]
  api --> store[("PostgreSQL")]
  api -.-> cache[("Redis")]
  check{"Cached?"} ==> api
  classDef edge fill:#101820,stroke:#c98f4b
  class browser,proxy edge
`;

describe("parseFlowchart", () => {
  it("reads direction, shapes, edges, labels, and classes", () => {
    const { model, problem } = parseFlowchart(source);
    expect(problem).toBeNull();
    expect(model.direction).toBe("LR");

    expect(
      model.nodes.map((node) => [node.id, node.shape, node.label]),
    ).toEqual([
      ["browser", "rectangle", "Browser"],
      ["proxy", "stadium", "Proxy"],
      ["api", "subroutine", "API"],
      ["store", "cylinder", "PostgreSQL"],
      ["cache", "cylinder", "Redis"],
      ["check", "diamond", "Cached?"],
    ]);

    expect(model.edges).toEqual([
      { from: "browser", to: "proxy", label: null, kind: "arrow" },
      { from: "proxy", to: "api", label: "authorised", kind: "arrow" },
      { from: "api", to: "store", label: null, kind: "arrow" },
      { from: "api", to: "cache", label: null, kind: "dotted" },
      { from: "check", to: "api", label: null, kind: "thick" },
    ]);

    expect(
      model.nodes.filter((node) => node.className === "edge").map((n) => n.id),
    ).toEqual(["browser", "proxy"]);
  });

  it("keeps what it does not model, so nothing is lost on a round trip", () => {
    const { model } = parseFlowchart(source);
    expect(model.residual).toContain(
      "  classDef edge fill:#101820,stroke:#c98f4b",
    );
    expect(model.residual.some((line) => line.includes("%%"))).toBe(true);

    const again = parseFlowchart(toMermaid(model));
    expect(again.model.nodes).toEqual(model.nodes);
    expect(again.model.edges).toEqual(model.edges);
    expect(again.model.direction).toBe(model.direction);
    expect(toMermaid(again.model)).toContain("classDef edge");
  });

  it("reads the `A -- label --> B` form too", () => {
    const { model } = parseFlowchart(`flowchart TD
  a["A"] -- retries --> b["B"]
`);
    expect(model.edges[0]).toEqual({
      from: "a",
      to: "b",
      label: "retries",
      kind: "arrow",
    });
  });

  it("lets a later mention name a node first seen bare", () => {
    const { model } = parseFlowchart(`flowchart TD
  a --> b
  a["Gateway"]
`);
    expect(model.nodes.find((node) => node.id === "a")?.label).toBe("Gateway");
  });

  it("says so, rather than guessing, when it is not an editable flowchart", () => {
    expect(parseFlowchart("sequenceDiagram\n  A->>B: hi").problem).toMatch(
      /flowchart/u,
    );
    expect(parseFlowchart("   ").problem).toMatch(/empty/u);
  });
});

describe("toMermaid", () => {
  it("quotes labels so brackets and arrows cannot become structure", () => {
    expect(quoteLabel('A [weird] "label"')).toBe('"A [weird]  label"');

    const model: DiagramModel = {
      ...emptyModel,
      nodes: [
        {
          id: "a",
          label: "Store --> [primary]",
          shape: "rectangle",
          className: null,
        },
      ],
    };
    const written = toMermaid(model);
    expect(written).toContain('a["Store --> [primary]"]');
    // What comes back is one node, not an accidental edge.
    const reparsed = parseFlowchart(written);
    expect(reparsed.model.nodes).toHaveLength(1);
    expect(reparsed.model.edges).toHaveLength(0);
  });

  it("writes class assignments grouped by class", () => {
    const model: DiagramModel = {
      ...emptyModel,
      nodes: [
        { id: "a", label: "A", shape: "rectangle", className: "accent" },
        { id: "b", label: "B", shape: "rectangle", className: "accent" },
        { id: "c", label: "C", shape: "rectangle", className: null },
      ],
    };
    expect(toMermaid(model)).toContain("class a,b accent");
  });
});

describe("editing the model", () => {
  const model = parseFlowchart(source).model;

  it("removes the edges of a node it removes", () => {
    const without = removeNode(model, "api");
    expect(without.nodes.some((node) => node.id === "api")).toBe(false);
    expect(
      without.edges.some((edge) => edge.from === "api" || edge.to === "api"),
    ).toBe(false);
  });

  it("carries every reference when an identifier is renamed", () => {
    const renamed = renameNode(model, "api", "gateway");
    expect(renamed.nodes.some((node) => node.id === "gateway")).toBe(true);
    expect(renamed.edges.filter((edge) => edge.to === "gateway")).toHaveLength(
      2,
    );
    expect(
      renamed.edges.some((edge) => edge.from === "api" || edge.to === "api"),
    ).toBe(false);
  });

  it("refuses a rename that would collide or is not an identifier", () => {
    expect(renameNode(model, "api", "store")).toBe(model);
    expect(renameNode(model, "api", "not an id")).toBe(model);
  });

  it("moves a node within the order and stops at the ends", () => {
    expect(moveNode(model, "proxy", -1).nodes[0]!.id).toBe("proxy");
    expect(moveNode(model, "browser", -1)).toBe(model);
  });

  it("makes identifiers that read as names and never collide", () => {
    expect(nextNodeId(model, "Load Balancer")).toBe("load_balancer");
    expect(nextNodeId(model, "api")).toBe("api_2");
    expect(nextNodeId(model, "2fa")).toMatch(/^node_/u);
  });
});
