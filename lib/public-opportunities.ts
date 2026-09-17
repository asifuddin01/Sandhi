import "server-only";

import { cache } from "react";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import { publicAreaWhere, publicOpportunityWhere } from "@/lib/visibility";

export const OPPORTUNITY_KINDS = [
  "RESEARCH_POSITION",
  "INTERNSHIP",
  "COLLABORATION",
  "PROJECT_OPENING",
] as const;

export type PublicOpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const OPPORTUNITIES_LEAD =
  "Openings for researchers, interns, and collaborators.";
export const OPPORTUNITIES_EMPTY =
  "There are no open positions right now. You can still introduce yourself through Join SANDHI.";

export const OPPORTUNITY_KIND_LABELS: Record<PublicOpportunityKind, string> = {
  RESEARCH_POSITION: "Research positions",
  INTERNSHIP: "Internships",
  COLLABORATION: "Collaborations",
  PROJECT_OPENING: "Project-specific openings",
};

export interface PublicOpportunitySummary {
  slug: string;
  title: string;
  kind: PublicOpportunityKind;
  duration: string | null;
  location: string | null;
  isRemote: boolean;
  deadline: Date | null;
  areas: Array<{ slug: string; name: string }>;
}

export interface PublicOpportunityDetail extends PublicOpportunitySummary {
  description: string;
  responsibilities: string[];
  requirements: string[];
}

const opportunitySelect = {
  slug: true,
  title: true,
  kind: true,
  areaSlugs: true,
  description: true,
  responsibilities: true,
  requirements: true,
  duration: true,
  location: true,
  isRemote: true,
  deadline: true,
} as const;

async function publicAreaMap(areaSlugs: string[]) {
  const uniqueSlugs = Array.from(new Set(areaSlugs));
  if (uniqueSlugs.length === 0) {
    return new Map<string, { slug: string; name: string }>();
  }

  const areas = await getDb().researchArea.findMany({
    where: { AND: [publicAreaWhere, { slug: { in: uniqueSlugs } }] },
    select: { slug: true, name: true },
  });

  return new Map(areas.map((area) => [area.slug, area]));
}

function resolveAreas(
  areaSlugs: string[],
  areaBySlug: ReadonlyMap<string, { slug: string; name: string }>,
) {
  return areaSlugs.flatMap((slug) => {
    const area = areaBySlug.get(slug);
    return area ? [area] : [];
  });
}

function locationLabel(
  opportunity: Pick<PublicOpportunitySummary, "isRemote" | "location">,
): string {
  if (opportunity.isRemote && opportunity.location) {
    return `Remote, ${opportunity.location}`;
  }
  if (opportunity.isRemote) return "Remote";
  return opportunity.location ?? "Location not specified";
}

export { locationLabel as opportunityLocationLabel };

export function daysUntilDeadline(
  deadline: Date | string,
  now = new Date(),
): number | null {
  const date = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;

  return Math.max(
    0,
    Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );
}

export function opportunityClosingLabel(
  deadline: Date | string | null,
  now = new Date(),
): string | null {
  if (!deadline) return null;
  const days = daysUntilDeadline(deadline, now);
  if (days === null) return null;
  return `Closes in ${days} ${days === 1 ? "day" : "days"}`;
}

export async function getPublicOpportunities(
  now = new Date(),
): Promise<PublicOpportunitySummary[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb().opportunity.findMany({
    where: publicOpportunityWhere(now),
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    select: opportunitySelect,
  });
  const areaBySlug = await publicAreaMap(rows.flatMap((row) => row.areaSlugs));

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    duration: row.duration,
    location: row.location,
    isRemote: row.isRemote,
    deadline: row.deadline,
    areas: resolveAreas(row.areaSlugs, areaBySlug),
  }));
}

async function loadPublicOpportunityBySlug(
  slug: string,
): Promise<PublicOpportunityDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const row = await getDb().opportunity.findFirst({
    where: { AND: [publicOpportunityWhere(), { slug }] },
    select: opportunitySelect,
  });
  if (!row) return null;
  const areaBySlug = await publicAreaMap(row.areaSlugs);

  return {
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    description: row.description,
    responsibilities: row.responsibilities,
    requirements: row.requirements,
    duration: row.duration,
    location: row.location,
    isRemote: row.isRemote,
    deadline: row.deadline,
    areas: resolveAreas(row.areaSlugs, areaBySlug),
  };
}

export const getPublicOpportunityBySlug = cache(loadPublicOpportunityBySlug);
