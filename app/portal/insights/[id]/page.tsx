import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/Prose";
import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { INSIGHT_KIND_LABELS, type InsightKind } from "@/lib/insight-content";
import { workspaceMemberId } from "@/lib/portal-content";
import { getMemberInsight, memberMaySubmit } from "@/lib/portal/insights";
import { authorableMembers } from "@/lib/portal/publications";

import { DeleteDraft, EditInsight, SendForReview } from "../InsightForms";

export const metadata: Metadata = { title: "Research note" };

/** Where the note stands, said to the person who wrote it. */
const stateWords: Record<string, string> = {
  DRAFT: "A draft. Yours to change until you send it.",
  IN_REVIEW:
    "With the reviewers. You cannot change it now — ask them to send it back if it needs work.",
  SCHEDULED: "Accepted, and waiting for its publication date.",
  PUBLISHED: "Published on the public site.",
  ARCHIVED: "Archived. It is no longer on the public site.",
};

export default async function PortalInsightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer(`/portal/insights/${id}`);
  const insight = await getMemberInsight(viewer, id);
  if (!insight) notFound();

  const selfId = workspaceMemberId(viewer);
  // Only needed to draw the co-author checkboxes, so only fetched for
  // somebody who is going to see them.
  const authorable = insight.editable ? await authorableMembers() : [];

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal/insights">Your research notes</Link>
        </p>
        <h1>{insight.title}</h1>
        <p className={styles.lead}>{insight.summary}</p>
        <p className={styles.aside}>
          {INSIGHT_KIND_LABELS[insight.kind as InsightKind] ?? insight.kind}
          {" · "}
          {insight.authors.map((author) => author.name).join(", ")}
        </p>
      </header>

      <p className={styles.notice}>
        {stateWords[insight.state] ?? insight.state}
      </p>

      {insight.state === "PUBLISHED" ? (
        <p className={styles.aside}>
          <Link href={`/insights/${insight.slug}`}>
            Read it on the public site
          </Link>
        </p>
      ) : null}

      {memberMaySubmit(insight.state) ? (
        <section aria-labelledby="send" className={styles.section}>
          <h2 id="send">Send it to be read</h2>
          <p className={styles.hint}>
            A reviewer reads what you send and decides whether it is published.
            You will not be able to change it afterwards.
          </p>
          <SendForReview insightId={insight.id} />
        </section>
      ) : null}

      {insight.editable && selfId ? (
        <>
          <section aria-labelledby="edit" className={styles.section}>
            <h2 id="edit">The draft</h2>
            <EditInsight
              authorable={authorable}
              insight={insight}
              selfId={selfId}
            />
          </section>
          <section aria-labelledby="remove" className={styles.section}>
            <h2 id="remove">Delete it</h2>
            <p className={styles.hint}>
              This removes the draft entirely. Only a draft can be deleted.
            </p>
            <DeleteDraft insightId={insight.id} />
          </section>
        </>
      ) : (
        /* Not editable, so it is shown as it will be read rather than as a
           box full of Markdown. */
        <section aria-labelledby="note" className={styles.section}>
          <h2 id="note">The note</h2>
          <Prose>{insight.body}</Prose>
        </section>
      )}
    </div>
  );
}
