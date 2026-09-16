"use client";

import { useEffect, useState } from "react";

import { JunctionNode } from "@/components/brand/JunctionNode";

const MOTION_CHANGE_EVENT = "sandhi:motion-change";

function motionIsReduced() {
  return (
    document.documentElement.dataset.reduceMotion === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MarginThread() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    function updateProgress() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (motionIsReduced()) {
          setProgress(1);
          return;
        }

        const scrollable =
          document.documentElement.scrollHeight - window.innerHeight;
        const next = scrollable > 0 ? window.scrollY / scrollable : 1;
        setProgress(Math.min(1, Math.max(0, next)));
      });
    }

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    window.addEventListener(MOTION_CHANGE_EVENT, updateProgress);
    media.addEventListener("change", updateProgress);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      window.removeEventListener(MOTION_CHANGE_EVENT, updateProgress);
      media.removeEventListener("change", updateProgress);
    };
  }, []);

  return (
    <div className="margin-thread" aria-hidden="true">
      <span className="margin-thread__rail" />
      <span
        className="margin-thread__progress"
        style={{ transform: `scaleY(${progress})` }}
      />
      <JunctionNode className="margin-thread__node margin-thread__node--top" />
      <JunctionNode
        className="margin-thread__node margin-thread__node--middle"
        active={progress >= 0.5}
      />
      <JunctionNode
        className="margin-thread__node margin-thread__node--bottom"
        active={progress >= 0.95}
      />
    </div>
  );
}
