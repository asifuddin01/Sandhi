"use client";

import Link from "next/link";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useReducedMotion } from "@/components/motion/useReducedMotion";
import type { GraphEdge, GraphNode, PublicGraphData } from "@/lib/graph-types";

import styles from "./ConnectionsMap.module.css";
import {
  estimateTextWidth,
  layerHeadings,
  layerOrder,
  layoutGraph,
  placeFocusLabel,
  type MeasureText,
} from "./graph-layout";
import { startNeuralSignals } from "./neural-signals";

type View = "map" | "list";

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

function createTextMeasure(font: string | null): MeasureText {
  const context = font
    ? document.createElement("canvas").getContext("2d")
    : null;
  if (context && font) context.font = font;
  const widths = new Map<string, number>();

  return (text) => {
    let width = widths.get(text);
    if (width === undefined) {
      width = context
        ? context.measureText(text).width
        : estimateTextWidth(text);
      widths.set(text, width);
    }
    return width;
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
        {layerOrder.flatMap((kind) =>
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
  const svgRef = useRef<SVGSVGElement>(null);
  const signalsRef = useRef<SVGGElement>(null);
  const probeRef = useRef<SVGTextElement>(null);
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("map");
  const [theme, setTheme] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [width, setWidth] = useState(900);
  // Replaced (not mutated) once web fonts load, so labels are re-measured.
  const [labelFont, setLabelFont] = useState<{ font: string } | null>(null);

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
  const selectedConnections = useMemo(() => {
    if (!selectedId) return [];
    const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
    const connected = new Map<string, GraphNode>();
    for (const edge of data.edges) {
      const otherId =
        edge.source === selectedId
          ? edge.target
          : edge.target === selectedId
            ? edge.source
            : null;
      const other = otherId ? nodeById.get(otherId) : undefined;
      if (other) connected.set(other.id, other);
    }
    return layerOrder
      .map((kind) => ({
        kind,
        nodes: [...connected.values()].filter((node) => node.kind === kind),
      }))
      .filter((group) => group.nodes.length > 0);
  }, [data, selectedId]);
  const layerCounts = layerOrder
    .map((kind) => ({
      kind,
      count: filtered.nodes.filter((node) => node.kind === kind).length,
    }))
    .filter((layer) => layer.count > 0);
  const focusId = activeId ?? selectedId;
  const related = useMemo(
    () => relatedIds(focusId, filtered.edges),
    [focusId, filtered.edges],
  );
  const measure = useMemo(
    () => createTextMeasure(labelFont?.font ?? null),
    [labelFont],
  );
  const layout = useMemo(
    () =>
      effectiveView === "map"
        ? layoutGraph(filtered.nodes, filtered.edges, width, measure)
        : null,
    [effectiveView, filtered.nodes, filtered.edges, width, measure],
  );
  const focusNode = focusId ? layout?.nodes.get(focusId) : undefined;
  const focusLabel =
    layout && focusNode
      ? placeFocusLabel(
          focusNode,
          data.nodes.find((node) => node.id === focusId)?.label ?? "",
          layout.width,
          measure,
        )
      : null;
  const signalFocus = focusNode ? focusNode.id : null;

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
      if (!container.isConnected || container.clientWidth < 1) return;
      const next = Math.max(320, Math.round(container.clientWidth));
      setWidth((current) => (current === next ? current : next));
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();
    return () => observer.disconnect();
  }, [effectiveView]);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    let active = true;
    const readFont = (fontsLoaded: boolean) => {
      if (!active) return;
      const style = window.getComputedStyle(probe);
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      setLabelFont((current) =>
        current?.font === font && !fontsLoaded ? current : { font },
      );
    };
    readFont(false);
    document.fonts?.ready.then(() => readFont(true));
    return () => {
      active = false;
    };
  }, [effectiveView]);

  useEffect(() => {
    const svg = svgRef.current;
    const signals = signalsRef.current;
    const container = containerRef.current;
    if (reducedMotion || !layout || !svg || !signals || !container) return;

    return startNeuralSignals({
      svg,
      layer: signals,
      viewport: container,
      edges: layout.edges,
      nodes: layout.nodes,
      sources: layout.layers[0] ?? [],
      focusId: signalFocus,
      classNames: {
        signal: styles.signal!,
        core: styles.signalCore!,
        halo: styles.signalHalo!,
        trail: styles.signalTrail!,
        ring: styles.signalRing!,
      },
    });
  }, [layout, reducedMotion, signalFocus]);

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

      {effectiveView === "list" || !layout ? (
        <GraphList data={filtered} />
      ) : (
        <div
          className={styles.canvasLayout}
          style={
            {
              "--network-width": `${layout.naturalWidth}px`,
            } as CSSProperties
          }
        >
          <div
            className={styles.canvas}
            ref={containerRef}
            style={{ height: `${layout.height}px` }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="img"
              aria-label={filtered.summary}
              preserveAspectRatio="xMidYMid meet"
            >
              <g className={styles.layerLabels} aria-hidden="true">
                {layout.headings.map((heading) =>
                  heading.text ? (
                    <text
                      key={heading.kind}
                      x={heading.x}
                      y={heading.y}
                      textAnchor={heading.anchor}
                    >
                      {heading.text}
                    </text>
                  ) : null,
                )}
              </g>
              <g aria-hidden="true">
                {layout.edges.map((edge) => {
                  const isRelated =
                    Boolean(focusId) &&
                    (edge.from === focusId || edge.to === focusId);
                  return (
                    <path
                      className={styles.edge}
                      data-edge-id={edge.id}
                      data-related={isRelated}
                      data-dimmed={Boolean(focusId) && !isRelated}
                      d={edge.path}
                      key={edge.id}
                    />
                  );
                })}
              </g>
              <g
                className={styles.signals}
                data-layer="signals"
                ref={signalsRef}
                aria-hidden="true"
              />
              <g>
                {filtered.nodes.map((node) => {
                  const placed = layout.nodes.get(node.id);
                  if (!placed) return null;
                  const isFocus = focusId === node.id;
                  return (
                    <g
                      className={styles.node}
                      data-node-id={node.id}
                      data-kind={node.kind}
                      data-active={isFocus}
                      data-selected={selectedId === node.id}
                      data-dimmed={related.size > 0 && !related.has(node.id)}
                      key={node.id}
                      transform={`translate(${placed.x} ${placed.y})`}
                      onClick={() => setSelectedId(node.id)}
                      onMouseEnter={() => setActiveId(node.id)}
                      onMouseLeave={() => setActiveId(null)}
                    >
                      <circle r={placed.radius} />
                      {placed.label && !isFocus ? (
                        <text
                          x={placed.labelDx}
                          y={placed.labelDy}
                          textAnchor={placed.labelAnchor}
                        >
                          {placed.label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
              {focusLabel?.text ? (
                <text
                  className={styles.focusLabel}
                  x={focusLabel.x}
                  y={focusLabel.y}
                  textAnchor={focusLabel.anchor}
                  aria-hidden="true"
                >
                  {focusLabel.text}
                </text>
              ) : null}
              <text
                className={styles.labelProbe}
                ref={probeRef}
                aria-hidden="true"
              >
                M
              </text>
            </svg>
          </div>
          <aside className={styles.panel} aria-live="polite">
            {selected ? (
              <>
                <p className={styles.kind}>{kindLabels[selected.kind]}</p>
                <h3>{selected.label}</h3>
                <p>{selected.description}</p>
                <Link href={selected.href}>Open {selected.label}</Link>
                {selectedConnections.length > 0 ? (
                  <div className={styles.connections}>
                    {selectedConnections.map(({ kind, nodes }) => (
                      <div key={kind}>
                        <h4>{layerHeadings[kind]}</h4>
                        <ul>
                          {nodes.map((node) => (
                            <li key={node.id}>
                              <Link href={node.href}>{node.label}</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className={styles.instruction}>
                  Select a junction to read its description and follow it into
                  the research archive.
                </p>
                <p className={styles.kind}>Layers</p>
                <ol className={styles.legend}>
                  {layerCounts.map(({ kind, count }) => (
                    <li key={kind}>
                      <span>{layerHeadings[kind]}</span>
                      <span>{count}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
