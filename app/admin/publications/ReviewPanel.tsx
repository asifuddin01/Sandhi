"use client";

import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import { reviewDecisionLabels } from "@/lib/publications";

import { reviewPublicationAction } from "./actions";

export interface ReviewEntry {
  id: string;
  comment: string;
  decision: string;
  reviewer: string;
  createdAt: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
}

/**
 * Internal review: a decision and a comment, kept with the publication. The
 * decision does not move the stage or publish anything. Making a paper public
 * stays a separate, deliberate act, so an approval can never do it by
 * accident.
 */
export function ReviewPanel({
  publicationId,
  stage,
  reviews,
}: {
  publicationId: string;
  stage: string;
  reviews: ReviewEntry[];
}) {
  return (
    <section className={styles.section} aria-labelledby="review-heading">
      <h2 id="review-heading">Internal review</h2>
      <p className={styles.hint}>
        {stage === "INTERNAL_REVIEW"
          ? "This publication is in internal review."
          : "Reviews can be recorded at any stage; the stage is changed in the form above."}
      </p>

      <ActionForm action={reviewPublicationAction} resetOnSuccess>
        <input type="hidden" name="publicationId" value={publicationId} />
        <div className={styles.field}>
          <label htmlFor="review-comment">Comment</label>
          <textarea
            id="review-comment"
            name="comment"
            rows={4}
            maxLength={4000}
            required
          />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="review-decision">Decision</label>
            <select id="review-decision" name="decision" defaultValue="APPROVED">
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </select>
          </div>
          <div className={styles.rowActions}>
            <SubmitButton tone="quiet" pending="Recording…">
              Record review
            </SubmitButton>
          </div>
        </div>
      </ActionForm>

      {reviews.length === 0 ? (
        <p className={styles.hint}>No reviews recorded yet.</p>
      ) : (
        <ol className={styles.reviewList}>
          {reviews.map((review) => (
            <li key={review.id}>
              <p className={styles.reviewMeta}>
                <strong>{reviewDecisionLabels[review.decision] ?? "Recorded"}</strong>{" "}
                by {review.reviewer} · {formatWhen(review.createdAt)}
              </p>
              <p>{review.comment}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
