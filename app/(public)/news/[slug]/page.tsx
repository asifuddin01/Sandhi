import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsArticle } from "@/components/entries/NewsArticle";
import { getPublicNewsBySlug } from "@/lib/public-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

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
  return <NewsArticle post={post} />;
}
