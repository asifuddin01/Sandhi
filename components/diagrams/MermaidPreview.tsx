"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./Diagrams.module.css";

/**
 * Renders Mermaid text. The library is large and only this page needs it, so
 * it is imported on first use rather than shipped with the portal — the same
 * treatment the WebGL field gets.
 */

let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid() {
  mermaidLoader ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      // Labels are escaped rather than parsed as HTML: diagram text can come
      // from a colleague, or from a file someone was sent.
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme: "dark",
      darkMode: true,
      fontFamily:
        'var(--font-hanken), ui-sans-serif, system-ui, -apple-system, sans-serif',
      flowchart: { curve: "basis", useMaxWidth: true },
    });
    return mermaid;
  });
  return mermaidLoader;
}

export interface PreviewProps {
  source: string;
  /** Called with the live SVG element, for exporting. */
  onRendered?: (svg: SVGSVGElement | null) => void;
  onError?: (message: string | null) => void;
}

export function MermaidPreview({ source, onRendered, onError }: PreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // A stale async render must not overwrite a newer one.
  const generation = useRef(0);

  useEffect(() => {
    const mine = ++generation.current;
    let cancelled = false;

    async function draw() {
      if (!source.trim()) {
        if (host.current) host.current.innerHTML = "";
        setProblem(null);
        onError?.(null);
        onRendered?.(null);
        return;
      }

      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(
          `diagram-${mine}`,
          source,
        );
        if (cancelled || mine !== generation.current || !host.current) return;
        host.current.innerHTML = svg;
        const element = host.current.querySelector("svg");
        setProblem(null);
        onError?.(null);
        onRendered?.(element);
      } catch (error) {
        if (cancelled || mine !== generation.current) return;
        const message =
          error instanceof Error
            ? error.message.split("\n")[0]!
            : "That diagram could not be drawn.";
        setProblem(message);
        onError?.(message);
        // The last good drawing stays on screen while the text is wrong, so
        // the diagram does not blink away on every keystroke.
      }
    }

    void draw();
    return () => {
      cancelled = true;
    };
  }, [source, onRendered, onError]);

  return (
    <div className={styles.preview}>
      <div
        className={styles.canvas}
        ref={host}
        role="img"
        aria-label="Diagram preview"
      />
      {problem ? (
        <p className={styles.previewProblem} role="status">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
