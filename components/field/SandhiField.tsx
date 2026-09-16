"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { SandhiFieldPoster } from "@/components/field/SandhiFieldPoster";

const SandhiFieldWebGL = dynamic(
  () =>
    import("@/components/field/SandhiFieldWebGL").then(
      (module) => module.SandhiFieldWebGL,
    ),
  { ssr: false },
);

export function SandhiField({ children }: { children: ReactNode }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  // Begin in the safe, static state on the server and during hydration. The
  // actual preference is read only after mount, so reduced-motion users never
  // request or mount the WebGL chunk.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [loadField, setLoadField] = useState(false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(
        media.matches ||
          document.documentElement.dataset.reduceMotion === "true",
      );
    };
    const observer = new MutationObserver(sync);
    media.addEventListener("change", sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-reduce-motion"],
    });
    sync();

    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    // Effects run after the server poster has painted. A short timer keeps the
    // sizeable Three.js chunk out of the critical rendering path without
    // depending on requestAnimationFrame, which browsers may throttle before a
    // newly-created tab becomes foregrounded.
    const timeoutId = window.setTimeout(() => setLoadField(true), 96);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reducedMotion]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.01 },
    );
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        className="sandhi-field"
        data-reduced-motion={reducedMotion}
        data-webgl={loadField && !reducedMotion}
        ref={fieldRef}
      >
        <SandhiFieldPoster />
        {loadField && !reducedMotion ? (
          <SandhiFieldWebGL active={inView} />
        ) : null}
      </div>
      {children}
    </>
  );
}
