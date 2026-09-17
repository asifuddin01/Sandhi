import Link from "next/link";

import { INSIGHT_KIND_LABELS } from "@/lib/insight-content";
import type { PublicInsightSummary } from "@/lib/public-insights";

import styles from "./Entries.module.css";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export function InsightEntry({ insight }: { insight: PublicInsightSummary }) {
  const publishedAt = insight.publishedAt ?? insight.createdAt;

  return (
    <article className={styles.newsEntry}>
      <div className={styles.entryMarker} aria-hidden="true">
        <span />
      </div>
      <div className={styles.entryBody}>
        <div className={styles.entryMeta}>
          <span>{INSIGHT_KIND_LABELS[insight.kind]}</span>
          <time dateTime={publishedAt.toISOString()}>
            {dateFormatter.format(publishedAt)}
          </time>
          <span>{insight.readingMinutes} min read</span>
        </div>
        <h2 className={styles.entryTitle}>
          <Link href={`/insights/${insight.slug}`}>{insight.title}</Link>
        </h2>
        {insight.authors.length > 0 ? (
          <p className={styles.authors}>
            By{" "}
            {insight.authors.map((author, index) => (
              <span key={author.slug}>
                {index > 0 ? ", " : null}
                <Link href={`/people/${author.slug}`}>{author.name}</Link>
              </span>
            ))}
          </p>
        ) : null}
        <p className={styles.excerpt}>{insight.summary}</p>
        <Link className={styles.readLink} href={`/insights/${insight.slug}`}>
          Read note
        </Link>
      </div>
    </article>
  );
}
