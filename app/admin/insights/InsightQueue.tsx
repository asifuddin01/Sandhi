import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import type {
  InsightDecision,
  InsightQueue as Queue,
  InsightQueueRow,
} from "@/lib/admin/insights";
import { INSIGHT_KIND_LABELS, type InsightKind } from "@/lib/insight-content";

import { Decide } from "./DecisionForms";

/** The same words the action answers with, so the page reads consistently. */
const WORDS: Record<string, string> = {
  PUBLISHED: "published",
  DRAFT: "sent back to its author",
  ARCHIVED: "withdrawn",
};

function Note({
  note,
  children,
}: {
  note: InsightQueueRow;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={note.title} className={styles.section} key={note.id}>
      <h3>
        {note.state === "PUBLISHED" || note.state === "ARCHIVED" ? (
          <Link href={`/insights/${note.slug}`}>{note.title}</Link>
        ) : (
          note.title
        )}
      </h3>
      <p>{note.summary}</p>
      <p className={styles.hint}>
        {INSIGHT_KIND_LABELS[note.kind as InsightKind] ?? note.kind}
        {" · "}
        {note.authors.join(", ") || "Nobody"}
        {" · Last touched "}
        <time dateTime={note.updatedAt.toISOString()}>
          {formatAdminTime(note.updatedAt)}
        </time>
        {note.publishedAt ? (
          <>
            {" · First published "}
            <time dateTime={note.publishedAt.toISOString()}>
              {formatAdminTime(note.publishedAt)}
            </time>
          </>
        ) : null}
      </p>
      <div className={styles.actions}>{children}</div>
    </section>
  );
}

/**
 * The reviewers' lists and their buttons. Shared by the administration page
 * and the Insights page's own bar.
 */
export function InsightQueue({
  queue,
  decided,
}: {
  queue: Queue;
  decided: InsightDecision[];
}) {
  return (
    <>
      {/* A decision moves a note into another list, so the button that made
          it disappears along with its message. This says what happened. */}
      {decided.length > 0 ? (
        <section aria-labelledby="decided">
          <h2 id="decided">Decided in the last day</h2>
          <ul className={styles.noteList}>
            {decided.map((decision) => (
              <li key={`${decision.insightId}-${decision.at.toISOString()}`}>
                {decision.title ?? "A note since deleted"}
                {" — "}
                {WORDS[decision.to] ?? decision.to.toLowerCase()}
                {decision.by ? ` by ${decision.by}` : ""}
                {", "}
                <time dateTime={decision.at.toISOString()}>
                  {formatAdminTime(decision.at)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="in-review">
        <h2 id="in-review">Waiting to be read</h2>
        {queue.inReview.length === 0 ? (
          <p className={styles.empty}>Nothing is waiting.</p>
        ) : (
          queue.inReview.map((note) => (
            <Note key={note.id} note={note}>
              <Decide
                insightId={note.id}
                label="Publish it"
                state="PUBLISHED"
                tone="primary"
              />
              <Decide insightId={note.id} label="Send it back" state="DRAFT" />
            </Note>
          ))
        )}
      </section>

      <section aria-labelledby="drafts">
        <h2 id="drafts">Still being written</h2>
        {queue.drafts.length === 0 ? (
          <p className={styles.empty}>No drafts.</p>
        ) : (
          queue.drafts.map((note) => (
            <Note key={note.id} note={note}>
              <Decide
                insightId={note.id}
                label="Publish it anyway"
                state="PUBLISHED"
              />
            </Note>
          ))
        )}
      </section>

      <section aria-labelledby="out">
        <h2 id="out">Out</h2>
        {queue.published.length === 0 ? (
          <p className={styles.empty}>Nothing published yet.</p>
        ) : (
          queue.published.map((note) => (
            <Note key={note.id} note={note}>
              {note.state === "ARCHIVED" ? (
                <Decide
                  insightId={note.id}
                  label="Put it back"
                  state="PUBLISHED"
                />
              ) : (
                <Decide
                  insightId={note.id}
                  label="Withdraw it"
                  state="ARCHIVED"
                  tone="danger"
                />
              )}
            </Note>
          ))
        )}
      </section>
    </>
  );
}
