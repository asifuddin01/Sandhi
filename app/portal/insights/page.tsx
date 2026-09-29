import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { INSIGHT_KIND_LABELS, type InsightKind } from "@/lib/insight-content";
import { LAB_TIME_ZONE } from "@/lib/portal/dashboard";
import { getMemberInsights } from "@/lib/portal/insights";

export const metadata: Metadata = { title: "Your research notes" };

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: LAB_TIME_ZONE,
});

/** What each state means to the person who wrote it. */
const stateWords: Record<string, string> = {
  DRAFT: "Draft — yours to change",
  IN_REVIEW: "With the reviewers",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export default async function PortalInsightsPage() {
  const viewer = await requireViewer("/portal/insights");
  const insights = await getMemberInsights(viewer);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal">Portal</Link>
        </p>
        <h1>Your research notes</h1>
        <p className={styles.lead}>
          Write something up, then send it to be read. A reviewer decides what
          goes on the public site.
        </p>
        <div className={styles.actions}>
          <Link className="button button-primary" href="/portal/insights/new">
            Write a note
          </Link>
        </div>
      </header>

      <section aria-labelledby="yours" className={styles.section}>
        <h2 id="yours">Yours</h2>
        {insights.length === 0 ? (
          <p className={styles.hint}>
            Nothing yet. A note here is the lab thinking out loud — a finding,
            an explainer, something that did not work and why.
          </p>
        ) : (
          <ul className={styles.cardList}>
            {insights.map((insight) => (
              <li className={styles.card} key={insight.id}>
                <h3>
                  <Link href={`/portal/insights/${insight.id}`}>
                    {insight.title}
                  </Link>
                </h3>
                <p>{insight.summary}</p>
                <p className={styles.cardMeta}>
                  {INSIGHT_KIND_LABELS[insight.kind as InsightKind] ??
                    insight.kind}
                  {" · "}
                  {stateWords[insight.state] ?? insight.state}
                  {" · Last touched "}
                  <time dateTime={insight.updatedAt.toISOString()}>
                    {when.format(insight.updatedAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
