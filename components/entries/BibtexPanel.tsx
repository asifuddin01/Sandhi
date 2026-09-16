"use client";

import { useState } from "react";

import styles from "./Entries.module.css";

export interface BibtexPanelProps {
  bibtex: string;
}

export function BibtexPanel({ bibtex }: BibtexPanelProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  async function copyBibtex() {
    try {
      await navigator.clipboard.writeText(bibtex);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <details className={styles.bibtexPanel}>
      <summary>BibTeX</summary>
      <div className={styles.bibtexContent}>
        <pre tabIndex={0}>
          <code>{bibtex}</code>
        </pre>
        <div className={styles.copyRow}>
          <button type="button" onClick={copyBibtex}>
            {copyState === "copied" ? "Copied" : "Copy BibTeX"}
          </button>
          <span role="status" aria-live="polite">
            {copyState === "failed"
              ? "Copy failed. Select the BibTeX text to copy it."
              : copyState === "copied"
                ? "BibTeX copied to the clipboard."
                : ""}
          </span>
        </div>
      </div>
    </details>
  );
}
