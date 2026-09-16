"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { JunctionNode } from "@/components/brand/JunctionNode";

type SequenceStep = {
  title: string;
  description: string;
};

type SequenceStepsProps = {
  steps: readonly SequenceStep[];
  ariaLabel?: string;
};

const MOTION_CHANGE_EVENT = "sandhi:motion-change";

function subscribeToMotion(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener(MOTION_CHANGE_EVENT, onStoreChange);
  media.addEventListener("change", onStoreChange);

  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, onStoreChange);
    media.removeEventListener("change", onStoreChange);
  };
}

function motionIsReduced() {
  return (
    document.documentElement.dataset.reduceMotion === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function SequenceSteps({
  steps,
  ariaLabel = "Sequence",
}: SequenceStepsProps) {
  const rootRef = useRef<HTMLOListElement>(null);
  const [activeSteps, setActiveSteps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const reduced = useSyncExternalStore(
    subscribeToMotion,
    motionIsReduced,
    () => false,
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-step]"));
    if (reduced || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const newlyVisible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset.step));

        if (newlyVisible.length === 0) return;
        setActiveSteps((current) => {
          const next = new Set(current);
          newlyVisible.forEach((index) => next.add(index));
          return next;
        });
      },
      { rootMargin: "0px 0px -18%", threshold: 0.35 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [reduced, steps]);

  return (
    <ol className="sequence-steps" ref={rootRef} aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const active = reduced || activeSteps.has(index);
        return (
          <li
            className="sequence-step"
            data-step={index}
            data-active={active ? "true" : "false"}
            key={step.title}
          >
            <div className="sequence-step__marker" aria-hidden="true">
              <span className="sequence-step__number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <JunctionNode active={active} />
            </div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        );
      })}
    </ol>
  );
}
