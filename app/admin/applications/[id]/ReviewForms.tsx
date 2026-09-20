"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/admin/Admin.module.css";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  MAX_APPLICATION_NOTE,
  MAX_DECISION_MESSAGE,
  RATING_LABELS,
  RATINGS,
} from "@/lib/applications";
import { memberRanks, rankLabels } from "@/lib/member-rank";

import {
  addApplicationNoteAction,
  inviteApplicantAction,
  rateApplicationAction,
  sendDecisionAgainAction,
  setApplicationStatusAction,
} from "../actions";

/** Where this application has got to. */
export function StatusForm({ id, status }: { id: string; status: string }) {
  return (
    <ActionForm
      action={setApplicationStatusAction}
      className={styles.actionForm}
    >
      <input type="hidden" name="id" value={id} />
      <div className={styles.field}>
        <label htmlFor="application-status">State</label>
        <select
          defaultValue={status}
          id="application-status"
          key={status}
          name="status"
        >
          {APPLICATION_STATUSES.filter(
            // Invited is set by sending an invitation, never by hand.
            (value) => value !== "INVITED",
          ).map((value) => (
            <option key={value} value={value}>
              {APPLICATION_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="application-message">What to tell them</label>
        <textarea
          id="application-message"
          maxLength={MAX_DECISION_MESSAGE}
          name="message"
          rows={3}
        />
        <p className={styles.hint}>
          Optional, and sent to the applicant when the state becomes Accepted or
          Not this time. This is not a note: they read it.
        </p>
      </div>
      <SubmitButton tone="quiet" pending="Saving…">
        Set state
      </SubmitButton>
    </ActionForm>
  );
}

/**
 * Shown when a decision was made but the email never went. A decision the
 * person never hears is the thing this whole screen exists to prevent, so it
 * is stated plainly rather than left to somebody noticing.
 */
export function TellAgain({ id, name }: { id: string; name: string }) {
  return (
    <ActionForm action={sendDecisionAgainAction} className={styles.actionForm}>
      <input type="hidden" name="id" value={id} />
      <p className={styles.notice} role="status">
        {name} has <strong>not</strong> been told this decision — the email did
        not go.
      </p>
      <div className={styles.field}>
        <label htmlFor="application-retry-message">
          Message to send with it
        </label>
        <textarea
          id="application-retry-message"
          maxLength={MAX_DECISION_MESSAGE}
          name="message"
          rows={3}
        />
      </div>
      <SubmitButton pending="Sending…">Send it now</SubmitButton>
    </ActionForm>
  );
}

/** One reader's view, as a number, so a shortlist can be sorted by something. */
export function RatingForm({
  id,
  rating,
}: {
  id: string;
  rating: number | null;
}) {
  return (
    <ActionForm action={rateApplicationAction} className={styles.actionForm}>
      <input type="hidden" name="id" value={id} />
      <div className={styles.field}>
        <label htmlFor="application-rating">Rating</label>
        <select
          defaultValue={rating === null ? "" : String(rating)}
          id="application-rating"
          key={String(rating)}
          name="rating"
        >
          <option value="">Not rated</option>
          {RATINGS.map((value) => (
            <option key={value} value={value}>
              {RATING_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton tone="quiet" pending="Saving…">
        Save rating
      </SubmitButton>
    </ActionForm>
  );
}

/** Kept between the people reading applications; never shown to the applicant. */
export function NoteForm({ id }: { id: string }) {
  return (
    <ActionForm
      action={addApplicationNoteAction}
      className={styles.actionForm}
      resetOnSuccess
    >
      <input type="hidden" name="id" value={id} />
      <div className={styles.field}>
        <label htmlFor="application-note">Add a note</label>
        <textarea
          id="application-note"
          maxLength={MAX_APPLICATION_NOTE}
          name="body"
          rows={3}
        />
        <p className={styles.hint}>
          Only people who read applications see this. Write what the next reader
          needs to know.
        </p>
      </div>
      <SubmitButton tone="quiet" pending="Saving…">
        Add note
      </SubmitButton>
    </ActionForm>
  );
}

/**
 * The moment an application becomes a person in the lab. It sends the same
 * invitation the members manager does, so they land in the same onboarding.
 *
 * It stays on the page once the invitation has gone, holding nothing but its
 * own outcome. Sending revalidates this page, and a form that unmounted on
 * the way would take its message with it — including the one that matters,
 * which is that the email did not go and needs resending.
 */
export function InviteApplicant({
  id,
  name,
  invited,
}: {
  id: string;
  name: string;
  invited: boolean;
}) {
  return (
    <ActionForm action={inviteApplicantAction} className={styles.actionForm}>
      <input type="hidden" name="id" value={id} />
      {invited ? (
        <p className={styles.hint}>
          An invitation has been sent to {name}. Resend or withdraw it from
          Members.
        </p>
      ) : (
        <>
          <div className={styles.field}>
            <label htmlFor="application-rank">Joining as</label>
            <select defaultValue="RESEARCHER" id="application-rank" name="rank">
              {memberRanks.map((rank) => (
                <option key={rank} value={rank}>
                  {rankLabels[rank]}
                </option>
              ))}
            </select>
            <p className={styles.hint}>
              {name} receives an invitation link. Administration is granted
              separately, in Members.
            </p>
          </div>
          <SubmitButton pending="Sending…">Send invitation</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
