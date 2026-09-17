import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InsightCitation } from "@/components/entries/InsightCitation";
import { Prose } from "@/components/Prose";
import {
  generateInsightBibtex,
  INSIGHT_KIND_LABELS,
} from "@/lib/insight-content";
import { getPublicInsightBySlug } from "@/lib/public-insights";
import { serializeJsonLd } from "@/lib/public-content";

import contentStyles from "../../ContentPages.module.css";
import styles from "./InsightPage.module.css";

type PageProps = { params: Promise<{ slug: string }> };

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function metaDescription(text: string): string {
  const plain = text.replace(/\s+/gu, " ").trim();
  return plain.length > 158 ? `${plain.slice(0, 155)}…` : plain;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const insight = await getPublicInsightBySlug(slug);
  if (!insight) {
    return {
      title: "Insight not found",
      robots: { index: false, follow: false },
    };
  }

  const publishedAt = insight.publishedAt ?? insight.createdAt;
  return {
    title: insight.title,
    description: metaDescription(insight.summary),
    alternates: { canonical: `/insights/${insight.slug}` },
    authors: insight.authors.map(({ name }) => ({ name })),
    openGraph: {
      type: "article",
      title: `${insight.title} | SANDHI Research Lab`,
      description: metaDescription(insight.summary),
      url: `/insights/${insight.slug}`,
      publishedTime: publishedAt.toISOString(),
      modifiedTime: insight.updatedAt.toISOString(),
      authors: insight.authors.map(({ name }) => name),
    },
    twitter: {
      card: "summary_large_image",
      title: insight.title,
      description: metaDescription(insight.summary),
    },
  };
}

export default async function InsightPage({ params }: PageProps) {
  const { slug } = await params;
  const insight = await getPublicInsightBySlug(slug);
  if (!insight) notFound();

  const publishedAt = insight.publishedAt ?? insight.createdAt;
  const canonicalUrl = `https://sandhiresearch.org/insights/${insight.slug}`;
  const bibtex = generateInsightBibtex({
    slug: insight.slug,
    title: insight.title,
    authors: insight.authors.map(({ name }) => name),
    publishedAt,
  });
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: insight.title,
    abstract: insight.summary,
    url: canonicalUrl,
    datePublished: publishedAt.toISOString(),
    dateModified: insight.updatedAt.toISOString(),
    author: insight.authors.map((author) => ({
      "@type": "Person",
      name: author.name,
      url: `https://sandhiresearch.org/people/${author.slug}`,
    })),
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
        name: "Insights",
        item: "https://sandhiresearch.org/insights",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: insight.title,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <article className={styles.page}>
      <script
        id="insight-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
      />
      <script
        id="insight-breadcrumb-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbsJsonLd) }}
      />

      <nav className={contentStyles.breadcrumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/insights">Insights</Link>
          </li>
          <li aria-current="page">{insight.title}</li>
        </ol>
      </nav>

      <header className={styles.header}>
        <h1>{insight.title}</h1>
        <p className={styles.summary}>{insight.summary}</p>
        <div className={styles.meta}>
          <span>{INSIGHT_KIND_LABELS[insight.kind]}</span>
          <time dateTime={publishedAt.toISOString()}>
            {dateFormatter.format(publishedAt)}
          </time>
          <span>{insight.readingMinutes} min read</span>
        </div>
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
      </header>

      <div className={styles.readingGrid}>
        {insight.headings.length > 0 ? (
          <nav className={styles.toc} aria-label="On this page">
            <p>On this page</p>
            <ol>
              {insight.headings.map((heading) => (
                <li data-depth={heading.depth} key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.label}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className={styles.body}>
          <Prose>{insight.body}</Prose>
          <InsightCitation bibtex={bibtex} />
        </div>
      </div>
    </article>
  );
}
