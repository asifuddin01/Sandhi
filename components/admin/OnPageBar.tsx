"use client";

import { useState, type ReactNode } from "react";

import styles from "./Admin.module.css";

/**
 * The buttons of the on-page administration bar. Only the opened editor is
 * mounted: the editors share field ids, so two could not be on a page at once.
 */
export function OnPageBar({
  actions,
}: {
  actions: Array<{ label: string; editor: ReactNode }>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <aside
      className={`page-shell ${styles.onPage}`}
      aria-label="Administration"
    >
      <div className={styles.onPageBar}>
        <p>Administration</p>
        {actions.map(({ label }, index) => (
          <button
            key={label}
            type="button"
            className={styles.quietButton}
            aria-expanded={open === index}
            onClick={() => setOpen(open === index ? null : index)}
          >
            {label}
          </button>
        ))}
      </div>
      {open === null ? null : (
        <div key={open} className={styles.onPageEditor}>
          {actions[open]?.editor}
        </div>
      )}
    </aside>
  );
}
