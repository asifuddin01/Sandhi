import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicationDetail } from "@/components/entries/PublicationDetail";
import { getPublicPublicationBySlug } from "@/lib/public-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function description(text: string): string {
  const plain = text.replace(/\s+/gu, " ").trim();
  return plain.length > 158 ? `${plain.slice(0, 155)}…` : plain;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const publication = await getPublicPublicationBySlug(slug);

  if (!publication) {
    return {
      title: "Publication not found",
      robots: { index: false, follow: false },
    };
  }

  const scholar: Record<string, string | string[]> = {
    citation_title: publication.title,
  };
  if (publication.authors.length > 0) {
    scholar.citation_author = publication.authors.map(({ name }) => name);
  }
  if (publication.publishedAt) {
    scholar.citation_publication_date = publication.publishedAt
      .toISOString()
      .slice(0, 10);
  } else if (publication.year) {
    scholar.citation_publication_date = String(publication.year);
  }
  if (
    publication.venueName &&
    (publication.type === "CONFERENCE" || publication.type === "WORKSHOP")
  ) {
    scholar.citation_conference_title = publication.venueName;
  }
  if (publication.venueName && publication.type === "JOURNAL") {
    scholar.citation_journal_title = publication.venueName;
  }
  if (publication.pdfUrl) scholar.citation_pdf_url = publication.pdfUrl;
  if (publication.doi) scholar.citation_doi = publication.doi;
  if (publication.arxivId) scholar.citation_arxiv_id = publication.arxivId;

  return {
    title: publication.title,
    description: description(publication.abstract),
    alternates: { canonical: `/publications/${publication.slug}` },
    authors: publication.authors.map(({ name }) => ({ name })),
    keywords: publication.areas.map(({ name }) => name),
    openGraph: {
      type: "article",
      title: `${publication.title} | SANDHI Research Lab`,
      description: description(publication.abstract),
      url: `/publications/${publication.slug}`,
      publishedTime: publication.publishedAt?.toISOString(),
      modifiedTime: publication.updatedAt.toISOString(),
      authors: publication.authors.map(({ name }) => name),
    },
    twitter: {
      card: "summary_large_image",
      title: publication.title,
      description: description(publication.abstract),
    },
    other: scholar,
  };
}

export default async function PublicationPage({ params }: PageProps) {
  const { slug } = await params;
  const publication = await getPublicPublicationBySlug(slug);
  if (!publication) notFound();
  return <PublicationDetail publication={publication} />;
}
