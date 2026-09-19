import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AreaDetail } from "@/components/entries/AreaDetail";
import { getAreaBySlug } from "@/lib/public-research";

export const dynamic = "force-dynamic";

interface AreaPageProps {
  params: Promise<{ area: string }>;
}

export async function generateMetadata({
  params,
}: AreaPageProps): Promise<Metadata> {
  const { area: slug } = await params;
  const area = await getAreaBySlug(slug);

  if (!area) return { title: "Research area not found" };

  return {
    title: area.name,
    description: area.summary,
    alternates: { canonical: `/research/areas/${area.slug}` },
  };
}

export default async function AreaPage({ params }: AreaPageProps) {
  const { area: slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) notFound();

  return <AreaDetail area={area} />;
}
