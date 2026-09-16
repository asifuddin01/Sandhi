/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/Prose";
import {
  getPublicNewsBySlug,
  humanizeEnum,
  serializeJsonLd,
} from "@/lib/public-content";

import styles from "../../ContentPages.module.css";

type PageProps = {
  params: Promise<{ slug: string }>;
};

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
  const post = await getPublicNewsBySlug(slug);

  if (!post) {
    return {
      title: "News article not found",
      robots: { index: false, follow: false },
    };
  }

  const publishedAt = post.publishAt ?? post.createdAt;
  return {
    title: post.title,
    description: metaDescription(post.excerpt),
    alternates: { canonical: `/news/${post.slug}` },
    authors: post.author ? [{ name: post.author.name }] : undefined,
    openGraph: {
      type: "article",
      title: `${post.title} | SANDHI Research Lab`,
      description: metaDescription(post.excerpt),
      url: `/news/${post.slug}`,
      publishedTime: publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.author ? [post.author.name] : undefined,
      images: post.coverUrl
        ? [{ url: post.coverUrl, alt: post.coverAlt ?? "" }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: metaDescription(post.excerpt),
      images: post.coverUrl ? [post.coverUrl] : undefined,
    },
  };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublicNewsBySlug(slug);
  if (!post) notFound();

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
