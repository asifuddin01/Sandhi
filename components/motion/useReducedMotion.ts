"use client";

import { useSyncExternalStore } from "react";

function snapshot(): boolean {
  if (typeof document === "undefined") return true;
  return (
    document.documentElement.dataset.reduceMotion === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function subscribe(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const observer = new MutationObserver(onStoreChange);
  media.addEventListener("change", onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-reduce-motion"],
  });

  return () => {
    media.removeEventListener("change", onStoreChange);
    observer.disconnect();
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
