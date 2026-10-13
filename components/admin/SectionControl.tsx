"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { OnPage } from "./AdminForms";
import styles from "./Admin.module.css";

// One editor open on a page at a time: the editors share field ids. Which one
// is kept outside React, so the controls in a page's different sections need
// no parent in common.
let openId: string | null = null;
const listeners = new Set<() => void>();

function show(id: string | null) {
  openId = id;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether this editor is the open one, and a way to open or close it. */
export function useOpenEditor(id: string) {
  const current = useSyncExternalStore(
    subscribe,
    () => openId,
    () => null,
  );
  // The store outlives the page, so leaving the page closes what it opened.
  useEffect(
    () => () => {
      if (openId === id) show(null);
    },
    [id],
  );
  const set = useCallback((open: boolean) => show(open ? id : null), [id]);
  return [current === id, set] as const;
}

/**
 * "Add" or "Edit" in a section's heading, and the form it opens there. The
 * form closes once it has saved: the section below it is the confirmation.
 */
export function SectionControl({
  id,
  label,
  about,
  children,
}: {
  id: string;
  label: "Add" | "Edit";
  /** What the section holds, for the button's full name: "Edit overview". */
  about: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useOpenEditor(id);
  const [saved, setSaved] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const done = useCallback(() => {
    setOpen(false);
    setSaved(true);
    // The button pressed was at the foot of the form that has just gone.
    button.current?.scrollIntoView({ block: "start" });
  }, [setOpen]);
  const where = useMemo(() => ({ own: "", added: done }), [done]);

  return (
    <>
      <span className={styles.sectionControl}>
        <span
          className={styles.actionMessage}
          data-tone="success"
          role="status"
        >
          {saved && !open ? "Saved." : ""}
        </span>
        <button
          ref={button}
          type="button"
          className={styles.quietButton}
          aria-expanded={open}
          aria-label={`${open ? "Close" : label} ${about}`}
          onClick={() => {
            setOpen(!open);
            setSaved(false);
          }}
        >
          {open ? "Close" : label}
        </button>
      </span>
      {open ? (
        <div className={styles.sectionPanel}>
          <OnPage value={where}>{children}</OnPage>
        </div>
      ) : null}
    </>
  );
}
