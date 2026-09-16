"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sandhi-reduce-motion";
const MOTION_CHANGE_EVENT = "sandhi:motion-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(MOTION_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function ReduceMotionToggle() {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, () => false);

  function toggleMotion() {
    const next = !reduced;
    window.localStorage.setItem(STORAGE_KEY, String(next));
    if (next) document.documentElement.dataset.reduceMotion = "true";
    else delete document.documentElement.dataset.reduceMotion;
    window.dispatchEvent(
      new CustomEvent(MOTION_CHANGE_EVENT, { detail: { reduced: next } }),
    );
  }

  return (
    <button
      className="motion-toggle"
      type="button"
      role="switch"
      aria-checked={reduced}
      onClick={toggleMotion}
    >
      <span>Reduce motion</span>
      <span className="motion-toggle__track" aria-hidden="true">
        <span className="motion-toggle__thumb" />
      </span>
    </button>
  );
}
