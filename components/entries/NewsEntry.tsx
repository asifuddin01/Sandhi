import Link from "next/link";

import { humanizeEnum, type PublicNewsSummary } from "@/lib/public-content";

import styles from "./Entries.module.css";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export function NewsEntry({ post }: { post: PublicNewsSummary }) {
  const date = post.publishAt ?? post.createdAt;

  return (
    <article className={styles.newsEntry}>
      <div className={styles.entryMarker} aria-hidden="true">
        <span />
      </div>
      <div className={styles.entryBody}>
        <div className={styles.entryMeta}>
          <time dateTime={date.toISOString()}>
            {dateFormatter.format(date)}
          </time>
          <span>{humanizeEnum(post.category)}</span>
        </div>
        <h2 className={styles.entryTitle}>
          <Link href={`/news/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className={styles.excerpt}>{post.excerpt}</p>
        <Link className={styles.readLink} href={`/news/${post.slug}`}>
          Read article
        </Link>
      </div>
    </article>
  );
}
