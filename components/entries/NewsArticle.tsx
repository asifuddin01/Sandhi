/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import styles from "@/app/(public)/ContentPages.module.css";
import { Prose } from "@/components/Prose";
import {
  humanizeEnum,
  serializeJsonLd,
  type PublicNewsDetail,
} from "@/lib/public-content";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/**
 * A news article as readers see it. The public page and the admin preview
 * both render this, so a preview is exactly the published page.
 */
export function NewsArticle({ post }: { post: PublicNewsDetail }) {
  const publishedAt = post.publishAt ?? post.createdAt;
  const canonicalUrl = `https://sandhiresearch.org/news/${post.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.excerpt,
    url: canonicalUrl,
    datePublished: publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    ...(post.coverUrl ? { image: [post.coverUrl] } : {}),
    ...(post.author
      ? {
          author: {
            "@type": "Person",
            name: post.author.name,
            url: `https://sandhiresearch.org/people/${post.author.slug}`,
          },
        }
      : {}),
    publisher: {
      "@type": "ResearchOrganization",
      name: "SANDHI Research Lab",
      url: "https://sandhiresearch.org",
    },
  };
  const breadcrumbsJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "News",
        item: "https://sandhiresearch.org/news",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: post.title,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <article className={styles.detailPage}>
      <script
        id="news-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
      />
      <script
        id="news-breadcrumb-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbsJsonLd) }}
      />

      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/news">News</Link>
          </li>
          <li aria-current="page">{post.title}</li>
        </ol>
      </nav>

      <header className={styles.detailHeader}>
        <h1>{post.title}</h1>
        <div className={styles.detailMeta}>
          <span>{humanizeEnum(post.category)}</span>
          <time dateTime={publishedAt.toISOString()}>
            {dateFormatter.format(publishedAt)}
          </time>
          {post.author ? (
            <span>
              By{" "}
              <Link href={`/people/${post.author.slug}`}>
                {post.author.name}
              </Link>
            </span>
          ) : null}
        </div>
        <p className={styles.lead}>{post.excerpt}</p>
      </header>

      {post.coverUrl ? (
        <img
          className={styles.cover}
          src={post.coverUrl}
          alt={post.coverAlt?.trim() || post.title}
          width="1600"
          height="900"
        />
      ) : null}

      <div className={styles.detailGrid}>
        <div className={styles.articleBody}>
          <Prose>{post.body}</Prose>
        </div>

        {post.project || post.publication ? (
          <aside className={styles.sidebar} aria-label="Related research">
            {post.project ? (
              <section className={styles.sidebarSection}>
                <h2>Related project</h2>
                <p>
                  <Link href={`/projects/${post.project.slug}`}>
                    {post.project.title}
                  </Link>
                </p>
              </section>
            ) : null}
            {post.publication ? (
              <section className={styles.sidebarSection}>
                <h2>Related publication</h2>
                <p>
                  <Link href={`/publications/${post.publication.slug}`}>
                    {post.publication.title}
                  </Link>
                </p>
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </article>
  );
}
