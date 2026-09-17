import type { LaidOutEdge } from "./graph-layout";

const SVG_NS = "http://www.w3.org/2000/svg";
const HOP_DURATION_MS = 1_100;
const FIRE_DURATION_MS = 700;
const RING_DURATION_MS = 800;
const WAVE_STAGGER_MS = 700;
const RELAY_DELAY_MS = 90;
const WAVE_REST_MS = 1_100;
const FOCUS_REST_MS = 700;
const START_DELAY_MS = 400;
const TRAIL_LENGTH = 64;
const MAX_BRANCHES = 3;
const MAX_WAVE_SIGNALS = 28;
const MAX_FOCUS_EDGES = 12;
const MAX_RELAY_EDGES = 2;

export interface NeuralSignalOptions {
  svg: SVGSVGElement;
  /** An empty group, drawn between edges and nodes, that holds the signals. */
  layer: SVGGElement;
  /** Signals pause while this element is outside the viewport. */
  viewport: Element;
  edges: LaidOutEdge[];
  nodes: ReadonlyMap<string, { x: number; y: number; radius: number }>;
  /** Nodes that start each forward pass together. */
  sources: string[];
  /** When set, signals leave this node along each of its connections. */
  focusId: string | null;
  classNames: {
    signal: string;
    core: string;
    halo: string;
    trail: string;
    ring: string;
  };
}

interface Signal {
  path: SVGPathElement;
  length: number;
  reverse: boolean;
  startedAt: number;
  head: SVGGElement;
  trail: SVGPathElement;
  onArrive: () => void;
}

interface Wave {
  run: number;
  pending: number;
  launched: number;
  relayed: Set<string>;
  onDone: () => void;
}

type Arrival = (id: string, from: string) => void;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

/**
 * Runs forward passes across the map's real connections: every source fires,
 * signals travel layer by layer with a short trail, and each node fires with
 * an expanding ring as a signal arrives. Everything is imperative DOM work so a
 * frame never re-renders React; the loop runs only while signals travel and
 * stops while the map is off screen or the tab is hidden.
 */
export function startNeuralSignals({
  svg,
  layer,
  viewport,
  edges,
  nodes,
  sources,
  focusId,
  classNames,
}: NeuralSignalOptions): () => void {
  const paths = new Map<string, SVGPathElement>();
  svg
    .querySelectorAll<SVGPathElement>("path[data-edge-id]")
    .forEach((path) => paths.set(path.dataset.edgeId!, path));
  const nodeElements = new Map<string, SVGGElement>();
  svg
    .querySelectorAll<SVGGElement>("g[data-node-id]")
    .forEach((node) => nodeElements.set(node.dataset.nodeId!, node));

  const forward = new Map<string, LaidOutEdge[]>();
  const around = new Map<string, LaidOutEdge[]>();
  for (const edge of edges) {
    if (edge.toLayer > edge.fromLayer) {
      forward.set(edge.from, [...(forward.get(edge.from) ?? []), edge]);
    }
    around.set(edge.from, [...(around.get(edge.from) ?? []), edge]);
    around.set(edge.to, [...(around.get(edge.to) ?? []), edge]);
  }

  let signals: Signal[] = [];
  let frame = 0;
  let running = false;
  let inView = false;
  let run = 0;
  const timers = new Set<number>();
  const fireTimers = new Map<SVGGElement, number>();
  const conducting = new Map<SVGPathElement, number>();
  const rings = new Set<SVGCircleElement>();

  const later = (delay: number, callback: () => void) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const ring = (id: string) => {
    const node = nodes.get(id);
    if (!node) return;
    const circle = document.createElementNS(SVG_NS, "circle");
    if (typeof circle.animate !== "function") return;
    circle.setAttribute("class", classNames.ring);
    circle.setAttribute("cx", String(node.x));
    circle.setAttribute("cy", String(node.y));
    circle.setAttribute("r", String(node.radius + 1));
    layer.append(circle);
    rings.add(circle);
    const animation = circle.animate(
      [
        { transform: "scale(1)", opacity: 0.7 },
        { transform: "scale(2.3)", opacity: 0 },
      ],
      { duration: RING_DURATION_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    animation.onfinish = () => {
      circle.remove();
      rings.delete(circle);
    };
  };

  const fire = (id: string) => {
    const node = nodeElements.get(id);
    if (!node) return;
    node.dataset.firing = "true";
    window.clearTimeout(fireTimers.get(node));
    fireTimers.set(
      node,
      window.setTimeout(() => {
        delete node.dataset.firing;
        fireTimers.delete(node);
      }, FIRE_DURATION_MS),
    );
    ring(id);
  };

  const releasePath = (path: SVGPathElement) => {
    const remaining = (conducting.get(path) ?? 1) - 1;
    if (remaining > 0) {
      conducting.set(path, remaining);
    } else {
      conducting.delete(path);
      delete path.dataset.signal;
    }
  };

  const step = (now: number) => {
    frame = 0;
    const arrived: Signal[] = [];
    signals = signals.filter((signal) => {
      const progress = Math.min(
        1,
        Math.max(0, (now - signal.startedAt) / HOP_DURATION_MS),
      );
      if (progress >= 1) {
        arrived.push(signal);
        return false;
      }

      const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
      const head = (signal.reverse ? 1 - eased : eased) * signal.length;
      const point = signal.path.getPointAtLength(head);
      signal.head.setAttribute("transform", `translate(${point.x} ${point.y})`);

      // The trail is a dash of the edge itself, ending at the signal.
      const start = signal.reverse ? head : Math.max(0, head - TRAIL_LENGTH);
      const end = signal.reverse
        ? Math.min(signal.length, head + TRAIL_LENGTH)
        : head;
      signal.trail.style.strokeDasharray = `${end - start} ${
        signal.length + TRAIL_LENGTH
      }`;
      signal.trail.style.strokeDashoffset = String(-start);

      const opacity = String(Math.min(1, progress * 8, (1 - progress) * 6));
      signal.head.style.opacity = opacity;
      signal.trail.style.opacity = opacity;
      return true;
    });

    for (const signal of arrived) {
      signal.head.remove();
      signal.trail.remove();
      releasePath(signal.path);
      signal.onArrive();
    }
    if (signals.length > 0 && frame === 0) {
      frame = window.requestAnimationFrame(step);
    }
  };

  const launch = (edge: LaidOutEdge, from: string, onArrive: () => void) => {
    const path = paths.get(edge.id);
    if (!path) return false;

    const trail = document.createElementNS(SVG_NS, "path");
    trail.setAttribute("class", classNames.trail);
    trail.setAttribute("d", path.getAttribute("d") ?? "");
    trail.style.opacity = "0";
    const head = document.createElementNS(SVG_NS, "g");
    head.setAttribute("class", classNames.signal);
    head.style.opacity = "0";
    const halo = document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("class", classNames.halo);
    halo.setAttribute("r", "6");
    const core = document.createElementNS(SVG_NS, "circle");
    core.setAttribute("class", classNames.core);
    core.setAttribute("r", "2.25");
    head.append(halo, core);
    layer.append(trail, head);

    conducting.set(path, (conducting.get(path) ?? 0) + 1);
    path.dataset.signal = "true";
    signals.push({
      path,
      length: path.getTotalLength(),
      reverse: edge.from !== from,
      startedAt: performance.now(),
      head,
      trail,
      onArrive,
    });
    if (frame === 0) frame = window.requestAnimationFrame(step);
    return true;
  };

  const settle = (wave: Wave) => {
    wave.pending -= 1;
    if (wave.pending === 0 && wave.run === run) wave.onDone();
  };

  const relay = (
    wave: Wave,
    from: string,
    candidates: LaidOutEdge[],
    limit: number,
    arrive: Arrival,
  ) => {
    for (const edge of shuffled(candidates).slice(0, limit)) {
      if (wave.launched >= MAX_WAVE_SIGNALS) return;
      const to = edge.from === from ? edge.to : edge.from;
      wave.pending += 1;
      wave.launched += 1;
      const launched = launch(edge, from, () => {
        fire(to);
        arrive(to, from);
        settle(wave);
      });
      if (!launched) settle(wave);
    }
  };

  const ambientWave = (current: number) => {
    if (current !== run || sources.length === 0) return;
    const wave: Wave = {
      run: current,
      pending: 0,
      launched: 0,
      relayed: new Set(),
      onDone: () => later(WAVE_REST_MS, () => ambientWave(current)),
    };
    const arrive: Arrival = (id) => {
      if (wave.relayed.has(id)) return;
      wave.relayed.add(id);
      const next = forward.get(id) ?? [];
      if (next.length === 0) return;
      wave.pending += 1;
      later(RELAY_DELAY_MS, () => {
        relay(wave, id, next, MAX_BRANCHES, arrive);
        settle(wave);
      });
    };

    for (const source of sources) {
      wave.pending += 1;
      later(Math.random() * WAVE_STAGGER_MS, () => {
        wave.relayed.add(source);
        fire(source);
        relay(wave, source, forward.get(source) ?? [], MAX_BRANCHES, arrive);
        settle(wave);
      });
    }
  };

  const focusWave = (current: number) => {
    if (current !== run || !focusId) return;
    const origin = focusId;
    const wave: Wave = {
      run: current,
      pending: 0,
      launched: 0,
      relayed: new Set([origin]),
      onDone: () => later(FOCUS_REST_MS, () => focusWave(current)),
    };
    // Activation spreads one further hop away from the focused node.
    const arrive: Arrival = (id, from) => {
      if (wave.relayed.has(id)) return;
      wave.relayed.add(id);
      if (from !== origin) return;
      const onward = (around.get(id) ?? []).filter(
        (edge) => edge.from !== origin && edge.to !== origin,
      );
      if (onward.length === 0) return;
      wave.pending += 1;
      later(RELAY_DELAY_MS, () => {
        relay(wave, id, onward, MAX_RELAY_EDGES, arrive);
        settle(wave);
      });
    };

    fire(origin);
    wave.pending += 1;
    relay(wave, origin, around.get(origin) ?? [], MAX_FOCUS_EDGES, arrive);
    settle(wave);
  };

  const start = () => {
    if (running) return;
    running = true;
    run += 1;
    const current = run;
    if (focusId) later(0, () => focusWave(current));
    else later(START_DELAY_MS, () => ambientWave(current));
  };

  const stop = () => {
    if (!running) return;
    running = false;
    run += 1;
    window.cancelAnimationFrame(frame);
    frame = 0;
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    for (const signal of signals) {
      signal.head.remove();
      signal.trail.remove();
    }
    signals = [];
    rings.forEach((circle) => circle.remove());
    rings.clear();
    conducting.forEach((_, path) => delete path.dataset.signal);
    conducting.clear();
    fireTimers.forEach((timer, node) => {
      window.clearTimeout(timer);
      delete node.dataset.firing;
    });
    fireTimers.clear();
  };

  const sync = () => {
    if (inView && !document.hidden) start();
    else stop();
  };

  const observer = new IntersectionObserver(([entry]) => {
    inView = Boolean(entry?.isIntersecting);
    sync();
  });
  observer.observe(viewport);
  document.addEventListener("visibilitychange", sync);

  return () => {
    stop();
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
  };
}
