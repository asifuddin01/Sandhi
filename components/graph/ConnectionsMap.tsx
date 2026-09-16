"use client";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useReducedMotion } from "@/components/motion/useReducedMotion";
import type { GraphEdge, GraphNode, PublicGraphData } from "@/lib/graph-types";

import styles from "./ConnectionsMap.module.css";

type View = "map" | "list";

interface PositionedNode extends GraphNode, SimulationNodeDatum {
  x: number;
  y: number;
}

type PositionedEdge = Omit<GraphEdge, "source" | "target"> &
  SimulationLinkDatum<PositionedNode> & {
    source: string | PositionedNode;
    target: string | PositionedNode;
  };

const kindOrder: GraphNode["kind"][] = [
  "theme",
  "area",
  "project",
  "person",
  "publication",
];

const kindLabels: Record<GraphNode["kind"], string> = {
  theme: "Theme",
  area: "Research area",
  project: "Project",
  person: "Researcher",
  publication: "Publication",
};

function subscribeHydration() {
  return () => undefined;
}

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
}

function nodeRadius(kind: GraphNode["kind"]): number {
  if (kind === "theme") return 8;
  if (kind === "area") return 6;
  if (kind === "project") return 5;
  return 4;
}

function initialPosition(
  node: GraphNode,
  index: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const column = kindOrder.indexOf(node.kind);
  const sameKindOffset = ((index * 67) % Math.max(80, height - 100)) + 50;
  return {
    x: 60 + (column / Math.max(1, kindOrder.length - 1)) * (width - 120),
    y: sameKindOffset,
  };
}

function relatedIds(activeId: string | null, edges: GraphEdge[]): Set<string> {
  if (!activeId) return new Set();
  const related = new Set([activeId]);
  for (const edge of edges) {
    if (edge.source === activeId) related.add(edge.target);
    if (edge.target === activeId) related.add(edge.source);
  }
  return related;
}

function GraphList({ data }: { data: PublicGraphData }) {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const relations = new Map<
    string,
    Array<{ edge: GraphEdge; node: GraphNode }>
  >();

  for (const edge of data.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    relations.set(source.id, [
      ...(relations.get(source.id) ?? []),
      { edge, node: target },
    ]);
    relations.set(target.id, [
      ...(relations.get(target.id) ?? []),
      { edge, node: source },
    ]);
  }

  return (
    <div className={styles.list} aria-label="Research connections list">
      <ul>
        {kindOrder.flatMap((kind) =>
          data.nodes
            .filter((node) => node.kind === kind)
            .map((node) => (
              <li className={styles.listNode} key={node.id}>
                <div>
                  <Link href={node.href}>{node.label}</Link>
                  <span>{kindLabels[node.kind]}</span>
                </div>
                {(relations.get(node.id)?.length ?? 0) > 0 ? (
                  <ul className={styles.relations}>
                    {relations.get(node.id)?.map(({ edge, node: related }) => (
                      <li key={`${node.id}-${edge.id}`}>
                        {edge.relationship.replaceAll("-", " ")}:{" "}
                        <Link href={related.href}>{related.label}</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )),
        )}
      </ul>
    </div>
  );
}

export function ConnectionsMap({
  initialData,
}: {
  initialData: PublicGraphData;
}) {
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("map");
  const [theme, setTheme] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 900, height: 540 });
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const effectiveView: View = hydrated ? view : "list";
  const filtered = useMemo(() => {
    if (theme === "all") return data;
    const nodes = data.nodes.filter((node) => node.themeSlugs.includes(theme));
    const ids = new Set(nodes.map((node) => node.id));
    return {
      ...data,
      nodes,
      edges: data.edges.filter(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      ),
    };
  }, [data, theme]);
  const selected = data.nodes.find((node) => node.id === selectedId) ?? null;
  const related = useMemo(
    () => relatedIds(activeId ?? selectedId, filtered.edges),
    [activeId, selectedId, filtered.edges],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/graph", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((next: PublicGraphData | null) => {
        if (next) setData(next);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const width = Math.max(320, Math.round(container.clientWidth));
      const height = width < 720 ? 450 : 540;
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const graphNodes: PositionedNode[] = filtered.nodes.map((node, index) => ({
      ...node,
      ...initialPosition(node, index, size.width, size.height),
    }));
    const graphEdges: PositionedEdge[] = filtered.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));

    const commit = () =>
      setPositions(
        Object.fromEntries(
          graphNodes.map((node) => [
            node.id,
            {
              x: Math.max(20, Math.min(size.width - 20, node.x)),
              y: Math.max(20, Math.min(size.height - 20, node.y)),
            },
          ]),
        ),
      );

    if (reducedMotion || effectiveView !== "map") {
      commit();
      return;
    }

    const simulation = forceSimulation<PositionedNode>(graphNodes)
      .force(
        "link",
        forceLink<PositionedNode, PositionedEdge>(graphEdges)
          .id((node) => node.id)
          .distance((edge) => (edge.relationship === "contains" ? 70 : 92))
          .strength(0.42),
      )
      .force("charge", forceManyBody().strength(-105).distanceMax(260))
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .force(
        "x",
        forceX<PositionedNode>((node) => {
          const column = kindOrder.indexOf(node.kind);
          return 60 + (column / 4) * (size.width - 120);
        }).strength(0.14),
      )
      .force("y", forceY(size.height / 2).strength(0.035))
      .force(
        "collide",
        forceCollide<PositionedNode>((node) => nodeRadius(node.kind) + 14),
      )
      .alphaDecay(0.045)
      .velocityDecay(0.48)
      .on("tick", commit);

    let inView = true;
    const syncActivity = () => {
      if (document.hidden || !inView) simulation.stop();
      else if (simulation.alpha() > 0.015) simulation.restart();
    };
    const intersection = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        syncActivity();
      },
      { rootMargin: "120px" },
    );
    if (containerRef.current) intersection.observe(containerRef.current);
    document.addEventListener("visibilitychange", syncActivity);

    return () => {
      simulation.stop();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", syncActivity);
    };
  }, [effectiveView, filtered.edges, filtered.nodes, reducedMotion, size]);

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Filter map by theme">
          <button
            className={styles.filter}
            type="button"
            data-active={theme === "all"}
            aria-pressed={theme === "all"}
            onClick={() => setTheme("all")}
          >
            All themes
          </button>
          {data.themes.map((item) => (
            <button
              className={styles.filter}
              type="button"
              key={item.slug}
              data-active={theme === item.slug}
              aria-pressed={theme === item.slug}
              onClick={() => setTheme(item.slug)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <button
          className={styles.viewButton}
          type="button"
          onClick={() => setView(effectiveView === "map" ? "list" : "map")}
        >
          View as {effectiveView === "map" ? "list" : "map"}
        </button>
      </div>

      {data.sparse ? (
        <p className={styles.sparseNote}>
          Projects and papers will appear here as they are published.
        </p>
      ) : null}

      {effectiveView === "list" ? (
        <GraphList data={filtered} />
      ) : (
        <div className={styles.canvasLayout}>
          <div className={styles.canvas} ref={containerRef}>
            <svg
              viewBox={`0 0 ${size.width} ${size.height}`}
              role="img"
              aria-label={filtered.summary}
              preserveAspectRatio="xMidYMid meet"
            >
              <g aria-hidden="true">
                {filtered.edges.map((edge) => {
                  const source = positions[edge.source];
                  const target = positions[edge.target];
                  if (!source || !target) return null;
                  const isRelated =
                    Boolean(activeId ?? selectedId) &&
                    (edge.source === (activeId ?? selectedId) ||
                      edge.target === (activeId ?? selectedId));
                  return (
                    <line
                      className={styles.edge}
                      data-related={isRelated}
                      data-dimmed={
                        Boolean(activeId ?? selectedId) && !isRelated
                      }
                      key={edge.id}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                    />
                  );
                })}
              </g>
              <g>
                {filtered.nodes.map((node) => {
                  const position =
                    positions[node.id] ??
                    initialPosition(node, 0, size.width, size.height);
                  const isActive = (activeId ?? selectedId) === node.id;
                  return (
                    <g
                      className={styles.node}
                      data-kind={node.kind}
                      data-active={isActive}
                      data-selected={selectedId === node.id}
                      data-dimmed={related.size > 0 && !related.has(node.id)}
                      key={node.id}
                      transform={`translate(${position.x} ${position.y})`}
                      onClick={() => setSelectedId(node.id)}
                      onMouseEnter={() => setActiveId(node.id)}
                      onMouseLeave={() => setActiveId(null)}
                    >
                      <circle r={nodeRadius(node.kind)} />
                      <text x={nodeRadius(node.kind) + 6} y={4}>
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          <aside className={styles.panel} aria-live="polite">
            {selected ? (
              <>
                <p className={styles.kind}>{kindLabels[selected.kind]}</p>
                <h3>{selected.label}</h3>
                <p>{selected.description}</p>
                <Link href={selected.href}>Open {selected.label}</Link>
              </>
            ) : (
              <p className={styles.instruction}>
                Select a junction to read its description and follow it into the
                research archive.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
