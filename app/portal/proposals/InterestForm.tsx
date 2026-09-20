"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/portal/Portal.module.css";
import { MAX_INTEREST_NOTE } from "@/lib/proposals";

import { markInterestAction } from "./actions";

/**
 * Saying you would work on this. A note is optional and says what you would
 * bring; the administrator reads that list when the team is formed.
 */
export function InterestForm({
  proposalId,
  interested,
  note,
}: {
  proposalId: string;
  interested: boolean;
  note: string | null;
}) {
  if (interested) {
    return (
      <ActionForm action={markInterestAction} className={styles.inlineForm}>
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="interested" value="no" />
        <p className={styles.cardMeta}>You are in{note ? `: ${note}` : ""}.</p>
        <SubmitButton tone="quiet" pending="Saving…">
          Take me off
        </SubmitButton>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={markInterestAction} className={styles.interestForm}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="interested" value="yes" />
      <div className={styles.field}>
        <label htmlFor={`note-${proposalId}`}>
          What you would bring (optional)
        </label>
        <input
          id={`note-${proposalId}`}
          name="note"
          maxLength={MAX_INTEREST_NOTE}
        />
      </div>
      <SubmitButton pending="Saving…">I would work on this</SubmitButton>
    </ActionForm>
  );
}
