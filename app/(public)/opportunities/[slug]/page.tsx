import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OpportunityDetail } from "@/components/entries/OpportunityDetail";
import { getPublicOpportunityBySlug } from "@/lib/public-opportunities";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = await getPublicOpportunityBySlug(slug);
  if (!opportunity) {
    return {
      title: "Opportunity not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: opportunity.title,
    description: opportunity.description.replace(/\s+/gu, " ").slice(0, 160),
    alternates: { canonical: `/opportunities/${opportunity.slug}` },
  };
}

export default async function OpportunityPage({ params }: PageProps) {
  const { slug } = await params;
  const opportunity = await getPublicOpportunityBySlug(slug);
  if (!opportunity) notFound();
  return <OpportunityDetail opportunity={opportunity} />;
}
