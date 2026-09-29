"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/admin/Admin.module.css";

import { decideInsightAction } from "./actions";

/**
 * One button per move, each its own form, so each reports its own outcome.
 * A single form with a dropdown would say "saved" without saying what it
 * saved.
 */
export function Decide({
  insightId,
  state,
  label,
  tone = "quiet",
}: {
  insightId: string;
  state: string;
  label: string;
  tone?: "primary" | "quiet" | "danger";
}) {
  return (
    <ActionForm action={decideInsightAction} className={styles.inlineForm}>
      <input type="hidden" name="insightId" value={insightId} />
      <input type="hidden" name="state" value={state} />
      <SubmitButton pending="Saving…" tone={tone}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
