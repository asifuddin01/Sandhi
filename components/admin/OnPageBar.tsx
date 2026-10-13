"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { AddedOnPage } from "./AdminForms";
import styles from "./Admin.module.css";

/**
 * The buttons of the on-page administration bar. Only the opened editor is
 * mounted: the editors share field ids, so two could not be on a page at once.
 */
export function OnPageBar({
  actions,
}: {
  actions: Array<{ label: string; editor: ReactNode; adding: boolean }>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const bar = useRef<HTMLElement>(null);
  // A saved new record closes its form: saving the same form twice would
  // make a second record. The button pressed was at the foot of the form, so
  // the bar, which now says what happened, is brought back into view.
  const onAdded = useCallback(() => {
    setOpen(null);
    setAdded(true);
    bar.current?.scrollIntoView({ block: "start" });
  }, []);
  const opened = open === null ? undefined : actions[open];

  return (
    <aside
      ref={bar}
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
            onClick={() => {
              setOpen(open === index ? null : index);
              setAdded(false);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className={styles.actionMessage} data-tone="success" role="status">
        {added
          ? "Added. Whatever is not on the site yet stays listed in this bar."
          : ""}
      </p>
      {opened ? (
        <div key={open} className={styles.onPageEditor}>
          <AddedOnPage value={opened.adding ? onAdded : null}>
            {opened.editor}
          </AddedOnPage>
        </div>
      ) : null}
    </aside>
  );
}
