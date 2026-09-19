import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResourceDetail } from "@/components/entries/ResourceDetail";
import { getPublicResourceBySlug } from "@/lib/public-resources";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function description(text: string): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}…` : normalized;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getPublicResourceBySlug(slug);
  if (!resource) {
    return {
      title: "Resource not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: resource.name,
    description: description(resource.description),
    alternates: { canonical: `/resources/${resource.slug}` },
  };
}

export default async function ResourcePage({ params }: PageProps) {
  const { slug } = await params;
  const resource = await getPublicResourceBySlug(slug);
  if (!resource) notFound();
  return <ResourceDetail resource={resource} />;
}
