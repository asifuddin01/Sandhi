import { getDb, isDatabaseConfigured } from "@/lib/db";
import type { JoinInterestType } from "@/lib/forms";

const kindToApplication: Record<string, JoinInterestType> = {
  RESEARCH_POSITION: "RESEARCHER",
  INTERNSHIP: "INTERNSHIP",
  COLLABORATION: "COLLABORATION",
  PROJECT_OPENING: "RESEARCHER",
};

export async function resolveOpenOpportunity(slug: string) {
  if (!isDatabaseConfigured()) return null;

  const opportunity = await getDb().opportunity.findFirst({
    where: {
      slug,
      state: "PUBLISHED",
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    },
    select: { id: true, slug: true, title: true, kind: true },
  });

  if (!opportunity) return null;
  return {
    id: opportunity.id,
    slug: opportunity.slug,
    title: opportunity.title,
    type: kindToApplication[opportunity.kind] ?? "RESEARCHER",
  };
}
