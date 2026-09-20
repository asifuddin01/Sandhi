"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/admin/Admin.module.css";
import { MAX_DECISION_NOTE } from "@/lib/proposals";

import { approveProposalAction, reviewProposalAction } from "../actions";

/**
 * A reviewer's move on one proposal. The note travels with it, because the
 * reason a proposal was queued or sent back is worth as much later as the
 * decision itself.
 */
export function ReviewMoves({
  id,
  moves,
}: {
  id: string;
  moves: Array<{ move: string; label: string; pending: string }>;
}) {
  if (moves.length === 0) return null;

  return (
    <ActionForm action={reviewProposalAction} className={styles.actionForm}>
      <input type="hidden" name="id" value={id} />
      <div className={styles.field}>
        <label htmlFor="decisionNote">Why (kept on the record)</label>
        <textarea
          id="decisionNote"
          name="decisionNote"
          rows={3}
          maxLength={MAX_DECISION_NOTE}
        />
        <p className={styles.hint}>
          Never shown publicly. Written for whoever picks this up next.
        </p>
      </div>
      <div className={styles.fieldRow}>
        {moves.map((move) => (
          <SubmitButton
            key={move.move}
            name="move"
            value={move.move}
            pending={move.pending}
            tone={move.move === "decline" ? "danger" : "quiet"}
          >
            {move.label}
          </SubmitButton>
        ))}
      </div>
    </ActionForm>
  );
}

/**
 * Approving is the moment a proposal becomes work: a project is made from it
 * and everyone who said they were interested joins the team. The lead is
 * named here, from that same list, because a team without one drifts.
 */
export function ApproveProposal({
  id,
  interested,
}: {
  id: string;
  interested: Array<{ id: string; name: string }>;
}) {
  return (
    <ActionForm action={approveProposalAction} className={styles.actionForm}>
      <input type="hidden" name="id" value={id} />
      <div className={styles.field}>
        <label htmlFor="leadMemberId">Research Lead</label>
        <select id="leadMemberId" name="leadMemberId" defaultValue="">
          <option value="">Name one later</option>
          {interested.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <p className={styles.hint}>
          {interested.length === 0
            ? "Nobody has said they are interested yet. Approving now makes an empty project."
            : `Everyone interested (${interested.length}) joins the project.`}
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="approveNote">Why (kept on the record)</label>
        <textarea
          id="approveNote"
          name="decisionNote"
          rows={2}
          maxLength={MAX_DECISION_NOTE}
        />
      </div>
      <SubmitButton pending="Approving…">
        Approve and make it a project
      </SubmitButton>
    </ActionForm>
  );
}
