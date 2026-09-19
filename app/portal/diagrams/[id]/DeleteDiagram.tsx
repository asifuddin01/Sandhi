"use client";

import { useState } from "react";

import { ActionMessage, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/diagrams/Diagrams.module.css";
import { useFormAction } from "@/components/forms/useFormAction";

import type { DiagramState } from "../actions";

/** Deleting asks first, because a diagram is not recoverable afterwards. */
export function DeleteDiagram({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action: (previous: DiagramState, formData: FormData) => Promise<DiagramState>;
}) {
  const [asking, setAsking] = useState(false);
  const { state, formAction, onSubmit } = useFormAction(action, {
    status: "idle",
  });

  if (!asking) {
    return (
      <p>
        <button
          type="button"
          className={styles.quietButton}
          onClick={() => setAsking(true)}
        >
          Delete this diagram
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <p className={styles.hint}>
        Delete &ldquo;{title}&rdquo;? This cannot be undone.
      </p>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.quietButton}
          onClick={() => setAsking(false)}
        >
          Keep it
        </button>
        <SubmitButton tone="quiet" pending="Deleting…">
          Delete
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
