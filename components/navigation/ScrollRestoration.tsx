"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const ENTRY_KEY = "__sandhiScrollEntry";
const STORAGE_PREFIX = "sandhi-scroll:";
const RESTORE_TIMEOUT_MS = 3_000;
const SETTLE_TIME_MS = 120;

interface ScrollPosition {
  x: number;
  y: number;
}

interface PendingRestoration {
  entryKey: string | null;
  route: string;
}

interface ActiveRestoration {
  route: string;
  cancel: () => void;
}

type KeyedHistory = History & { __sandhiScrollKeyed?: true };

/** The subset of the Navigation API used here; TypeScript 5.9 omits it. */
interface NavigationLike {
  addEventListener(
    type: "navigate",
    listener: (event: Event & NavigateEventLike) => void,
  ): void;
  removeEventListener(
    type: "navigate",
    listener: (event: Event & NavigateEventLike) => void,
  ): void;
}

interface NavigateEventLike {
  navigationType: "push" | "replace" | "reload" | "traverse";
  hashChange: boolean;
}

let afterEntryPush: ((entryKey: string) => void) | null = null;

function createEntryKey(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function entryKeyFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const key = Reflect.get(state, ENTRY_KEY);
  return typeof key === "string" ? key : null;
}

function stateWithEntryKey(state: unknown, entryKey: string) {
  const currentState =
    state && typeof state === "object"
      ? state
      : ({} as Record<string, unknown>);

  return { ...currentState, [ENTRY_KEY]: entryKey };
}

function currentEntryKey(): string | null {
  return entryKeyFromState(window.history.state);
}

/** Router entries get a key; fragment entries keep their null state. */
function ensureEntryKey(): void {
  if (!window.history.state || currentEntryKey()) return;
  window.history.replaceState(
    stateWithEntryKey(window.history.state, createEntryKey()),
    "",
  );
}

function routeKey(pathname: string, search: string): string {
  let path = pathname;
  try {
    path = decodeURI(pathname);
  } catch {
    // Keep the raw pathname when it contains a malformed escape.
  }
  const params = new URLSearchParams(search).toString();
  return params ? `${path}?${params}` : path;
}

function locationRoute(): string {
  return routeKey(window.location.pathname, window.location.search);
}

/**
 * Gives every pushed entry its own key. Installed once for the document and
 * never removed: Next.js wraps these methods after us, so unpatching from a
 * component cleanup would leave its router calling a stale function.
 */
function keyPushedHistoryEntries(): void {
  const history = window.history as KeyedHistory;
  if (history.__sandhiScrollKeyed) return;
  history.__sandhiScrollKeyed = true;

  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);

  history.pushState = (data, unused, url) => {
    const incomingKey = entryKeyFromState(data);
    // Callers often copy the current state; a new entry must not share its key.
    const entryKey =
      incomingKey && incomingKey !== currentEntryKey()
        ? incomingKey
        : createEntryKey();
    pushState(stateWithEntryKey(data, entryKey), unused, url);
    afterEntryPush?.(entryKey);
  };

  history.replaceState = (data, unused, url) => {
    const entryKey = entryKeyFromState(data) ?? currentEntryKey();
    replaceState(
      entryKey ? stateWithEntryKey(data, entryKey) : data,
      unused,
      url,
    );
  };
}

function savePosition(entryKey: string | null): void {
  if (!entryKey) return;

  try {
    const position: ScrollPosition = { x: window.scrollX, y: window.scrollY };
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${entryKey}`,
      JSON.stringify(position),
    );
  } catch {
    // Native history restoration remains available when storage is blocked.
  }
}

function readPosition(entryKey: string): ScrollPosition | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`${STORAGE_PREFIX}${entryKey}`) ?? "null",
    ) as Partial<ScrollPosition> | null;

    if (
      !value ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      value.x! < 0 ||
      value.y! < 0
    ) {
      return null;
    }

    return { x: value.x!, y: value.y! };
  } catch {
    return null;
  }
}

function scrollInstantly(x: number, y: number): void {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(x, y);
  root.style.scrollBehavior = previousBehavior;
}

/**
 * Re-applies the position until the page is tall enough and stays put.
 * `onFinish` runs once when restoration settles, times out, or the reader
 * takes over with input; the returned function stops it silently.
 */
function restoreWhenReady(
  position: ScrollPosition,
  onFinish: (settled: boolean) => void,
): () => void {
  let animationFrame = 0;
  let stopped = false;
  let settledAt: number | null = null;
  const startedAt = performance.now();

  const stop = () => {
    if (stopped) return false;
    stopped = true;
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("wheel", yieldToReader, true);
    window.removeEventListener("touchstart", yieldToReader, true);
    window.removeEventListener("pointerdown", yieldToReader, true);
    window.removeEventListener("keydown", yieldToReader, true);
    return true;
  };

  function yieldToReader() {
    if (stop()) onFinish(false);
  }

  const restore = (now: number) => {
    if (stopped) return;

    const scrollingElement =
      document.scrollingElement ?? document.documentElement;
    const maxX = Math.max(0, scrollingElement.scrollWidth - window.innerWidth);
    const maxY = Math.max(
      0,
      scrollingElement.scrollHeight - window.innerHeight,
    );
    const targetX = Math.min(position.x, maxX);
    const targetY = Math.min(position.y, maxY);
    const targetIsReachable = maxX >= position.x - 1 && maxY >= position.y - 1;
    const wasAtTarget =
      Math.abs(window.scrollX - position.x) <= 1 &&
      Math.abs(window.scrollY - position.y) <= 1;

    if (!targetIsReachable || !wasAtTarget) settledAt = null;
    scrollInstantly(targetX, targetY);

    if (targetIsReachable && settledAt === null) settledAt = now;
    if (settledAt !== null && now - settledAt >= SETTLE_TIME_MS) {
      if (stop()) onFinish(true);
      return;
    }
    if (now - startedAt >= RESTORE_TIMEOUT_MS) {
      if (stop()) onFinish(false);
      return;
    }

    animationFrame = window.requestAnimationFrame(restore);
  };

  window.addEventListener("wheel", yieldToReader, {
    capture: true,
    passive: true,
  });
  window.addEventListener("touchstart", yieldToReader, {
    capture: true,
    passive: true,
  });
  window.addEventListener("pointerdown", yieldToReader, {
    capture: true,
    passive: true,
  });
  window.addEventListener("keydown", yieldToReader, true);
  animationFrame = window.requestAnimationFrame(restore);

  return () => {
    stop();
  };
}

/**
 * Supplements native restoration for App Router history traversals. Positions
 * are attached to individual history entries, so revisiting the same URL can
 * still restore a different place on the page.
 *
 * Positions are recorded as the reader scrolls and before a traversal starts,
 * never in `popstate`: the router may commit the destination before this
 * component hears that event, so `scrollY` then can belong to either page.
 * Fragment entries keep a
 * null state and native restoration, because Next.js reloads the document when
 * it traverses to a state it did not create.
 */
export function ScrollRestoration() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [traversalVersion, setTraversalVersion] = useState(0);
  const pendingRestoration = useRef<PendingRestoration | null>(null);
  const activeRestoration = useRef<ActiveRestoration | null>(null);

  const recordPosition = useCallback(() => {
    if (pendingRestoration.current || activeRestoration.current) return;
    savePosition(currentEntryKey());
  }, []);

  useEffect(() => {
    keyPushedHistoryEntries();
    ensureEntryKey();

    const navigationEntry = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (
      (navigationEntry?.type === "back_forward" ||
        navigationEntry?.type === "reload") &&
      !window.location.hash
    ) {
      pendingRestoration.current = {
        entryKey: currentEntryKey(),
        route: locationRoute(),
      };
    }

    let pendingTimeout = 0;
    afterEntryPush = (entryKey) => {
      activeRestoration.current?.cancel();
      pendingRestoration.current = null;
      savePosition(entryKey);
    };

    const handlePopState = (event: PopStateEvent) => {
      activeRestoration.current?.cancel();
      const pending: PendingRestoration = {
        entryKey: entryKeyFromState(event.state),
        route: locationRoute(),
      };
      pendingRestoration.current = pending;
      // Never leave recording suspended if the router does not render the
      // destination (for example, when it reloads the document instead).
      window.clearTimeout(pendingTimeout);
      pendingTimeout = window.setTimeout(() => {
        if (pendingRestoration.current === pending) {
          pendingRestoration.current = null;
        }
      }, RESTORE_TIMEOUT_MS);
      setTraversalVersion((version) => version + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") recordPosition();
    };

    // Where supported, `navigate` fires before a traversal or fragment jump
    // is applied, so the outgoing entry still owns `scrollY` even when the
    // last scroll event has not been dispatched yet.
    const navigation = (window as Window & { navigation?: NavigationLike })
      .navigation;
    const handleNavigate = (event: NavigateEventLike) => {
      if (event.navigationType === "traverse" || event.hashChange) {
        recordPosition();
      }
    };

    // Scroll events are already dispatched at most once per frame. Recording
    // synchronously keeps the key and position from the same history entry.
    navigation?.addEventListener("navigate", handleNavigate);
    window.addEventListener("scroll", recordPosition, { passive: true });
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", recordPosition);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      afterEntryPush = null;
      activeRestoration.current?.cancel();
      window.clearTimeout(pendingTimeout);
      navigation?.removeEventListener("navigate", handleNavigate);
      window.removeEventListener("scroll", recordPosition);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", recordPosition);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [recordPosition]);

  useEffect(() => {
    const route = routeKey(pathname, search);
    if (
      activeRestoration.current &&
      activeRestoration.current.route !== route
    ) {
      activeRestoration.current.cancel();
    }

    const pending = pendingRestoration.current;
    // Wait until the router has rendered the destination of a traversal.
    if (pending && pending.route !== route) return;
    // A restoration already running for this route outlives re-renders.
    if (!pending && activeRestoration.current) return;
    pendingRestoration.current = null;

    const position = pending?.entryKey ? readPosition(pending.entryKey) : null;
    if (!pending?.entryKey || !position) {
      const frame = window.requestAnimationFrame(() => {
        ensureEntryKey();
        recordPosition();
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const entryKey = pending.entryKey;
    const restoration: ActiveRestoration = {
      route,
      cancel: () => {
        stop();
        if (activeRestoration.current === restoration) {
          activeRestoration.current = null;
        }
      },
    };
    const stop = restoreWhenReady(position, (settled) => {
      if (activeRestoration.current === restoration) {
        activeRestoration.current = null;
      }
      if (settled && currentEntryKey() === entryKey) savePosition(entryKey);
    });
    activeRestoration.current = restoration;
  }, [pathname, search, traversalVersion, recordPosition]);

  return null;
}
