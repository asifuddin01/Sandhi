"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  MarkdownField,
  TitleSlugFields,
} from "@/components/admin/ContentFields";
import styles from "@/components/portal/Portal.module.css";
import {
  INSIGHT_KIND_LABELS,
  INSIGHT_KINDS,
  MAX_INSIGHT_SUMMARY,
} from "@/lib/insight-content";
import type { MemberInsightDetail } from "@/lib/portal/insights";

import {
  createInsightAction,
  deleteInsightAction,
  submitInsightAction,
  updateInsightAction,
} from "./actions";

export interface AuthorOption {
  id: string;
  name: string;
}

/**
 * Everything a note records, shared by the form that starts one and the form
 * that changes it — so the two cannot come to describe different notes. The
 * editor and its live preview are the same ones administration uses, which
 * is what makes the preview match the published page exactly.
 */
function Fields({
  insight,
  authorable,
  selfId,
}: {
  insight?: MemberInsightDetail;
  authorable: AuthorOption[];
  selfId: string;
}) {
  const named = new Set(insight?.authors.map((author) => author.memberId));

  return (
    <>
      <TitleSlugFields
        defaultSlug={insight?.slug ?? ""}
        defaultTitle={insight?.title ?? ""}
        pathPrefix="/insights/"
      />

      <div className={styles.field}>
        <label htmlFor="kind">Kind</label>
        <select
          defaultValue={insight?.kind ?? "TECHNICAL_NOTE"}
          id="kind"
          name="kind"
        >
          {INSIGHT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {INSIGHT_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="summary">Summary</label>
        <textarea
          defaultValue={insight?.summary ?? ""}
          id="summary"
          maxLength={MAX_INSIGHT_SUMMARY}
          name="summary"
          required
          rows={3}
        />
        <p className={styles.hint}>
          One or two sentences. This is what the listing shows.
        </p>
      </div>

      <MarkdownField
        defaultValue={insight?.body ?? ""}
        hint="Markdown, with maths and code. The preview is the published page."
        id="body"
        label="The note"
        name="body"
      />

      {/* The writer is always an author and is never listed here: the action
          puts them first whatever the form says. */}
      <fieldset className={styles.who}>
        <legend className={styles.label}>Written with</legend>
        {authorable
          .filter((person) => person.id !== selfId)
          .map((person) => (
            <div className={styles.checkRow} key={person.id}>
              <input
                defaultChecked={named.has(person.id)}
                id={`author-${person.id}`}
                name="authorId"
                type="checkbox"
                value={person.id}
              />
              <label htmlFor={`author-${person.id}`}>{person.name}</label>
            </div>
          ))}
      </fieldset>
    </>
  );
}

export function WriteInsight({
  authorable,
  selfId,
}: {
  authorable: AuthorOption[];
  selfId: string;
}) {
  return (
    <ActionForm action={createInsightAction}>
      <Fields authorable={authorable} selfId={selfId} />
      <div className={styles.submit}>
        <SubmitButton pending="Starting…">Start the draft</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditInsight({
  insight,
  authorable,
  selfId,
}: {
  insight: MemberInsightDetail;
  authorable: AuthorOption[];
  selfId: string;
}) {
  return (
    <ActionForm action={updateInsightAction}>
      <input type="hidden" name="insightId" value={insight.id} />
      <Fields authorable={authorable} insight={insight} selfId={selfId} />
      <div className={styles.submit}>
        <SubmitButton pending="Saving…">Save the draft</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Handing it over. After this the author cannot change it. */
export function SendForReview({ insightId }: { insightId: string }) {
  return (
    <ActionForm action={submitInsightAction} className={styles.inlineForm}>
      <input type="hidden" name="insightId" value={insightId} />
      <SubmitButton pending="Sending…">Send it to be read</SubmitButton>
    </ActionForm>
  );
}

export function DeleteDraft({ insightId }: { insightId: string }) {
  return (
    <ActionForm action={deleteInsightAction} className={styles.inlineForm}>
      <input type="hidden" name="insightId" value={insightId} />
      <SubmitButton pending="Deleting…" tone="danger">
        Delete this draft
      </SubmitButton>
    </ActionForm>
  );
}
