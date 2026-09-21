"use client";

import { ActionMessage, SubmitButton } from "@/components/admin/AdminForms";
import { useFormAction } from "@/components/forms/useFormAction";
import styles from "@/components/portal/Portal.module.css";

import {
  submitPublicationForReviewAction,
  type PublicationFormState,
} from "../actions";

const idle: PublicationFormState = { status: "idle" };

/**
 * Handing a draft to the lab. After this the author stops editing: letting
 * one change a paper underneath the people reading it is how a review ends
 * up approving a version nobody saw.
 */
export function SendForReview({ id }: { id: string }) {
  const { state, formAction, onSubmit } = useFormAction(
    submitPublicationForReviewAction,
    idle,
  );

  return (
    <form action={formAction} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <p className={styles.hint}>
        The reviewers are told at once. You will not be able to edit it
        afterwards, so read it through first.
      </p>
      <SubmitButton pending="Sending…">Send for internal review</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
