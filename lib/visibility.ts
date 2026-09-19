import type { Prisma } from "@/generated/prisma/client";

export const PUBLICATION_PUBLIC_STAGES = ["ACCEPTED", "PUBLISHED"] as const;
export const PUBLIC_MEMBER_STATUSES = ["ACTIVE", "ALUMNI"] as const;

export const publicThemeWhere = {
  state: "PUBLISHED",
} satisfies Prisma.ResearchThemeWhereInput;

export const publicAreaWhere = {
  state: "PUBLISHED",
  theme: publicThemeWhere,
} satisfies Prisma.ResearchAreaWhereInput;

export const publicProjectWhere = {
  state: "PUBLISHED",
} satisfies Prisma.ProjectWhereInput;

export const publicMemberWhere = {
  isPublic: true,
  status: { in: [...PUBLIC_MEMBER_STATUSES] },
} satisfies Prisma.MemberWhereInput;

export const publicPublicationWhere = {
  state: "PUBLISHED",
  OR: [
    { stage: { in: [...PUBLICATION_PUBLIC_STAGES] } },
    { type: "PREPRINT", arxivId: { not: null } },
  ],
} satisfies Prisma.PublicationWhereInput;

export const publicResourceWhere = {
  state: "PUBLISHED",
} satisfies Prisma.ResourceWhereInput;

export const publicInsightWhere = {
  state: "PUBLISHED",
} satisfies Prisma.InsightWhereInput;

export const publicPartnerWhere = {
  state: "PUBLISHED",
} satisfies Prisma.PartnerWhereInput;

/**
 * Published posts whose time has come, and scheduled posts once their time
 * passes: scheduling needs no job to flip the state.
 */
export function publicNewsWhere(now = new Date()) {
  return {
    OR: [
      {
        state: "PUBLISHED",
        OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      },
      { state: "SCHEDULED", publishAt: { lte: now } },
    ],
  } satisfies Prisma.NewsPostWhereInput;
}

export function publicEventWhere() {
  return {
    state: "PUBLISHED",
    kind: { not: "INTERNAL" },
  } satisfies Prisma.EventWhereInput;
}

export function publicOpportunityWhere(now = new Date()) {
  return {
    state: "PUBLISHED",
    OR: [{ deadline: null }, { deadline: { gte: now } }],
  } satisfies Prisma.OpportunityWhereInput;
}

export interface OpportunityVisibilityInput {
  state: string;
  deadline?: Date | string | null;
}

/** An opportunity is public only while its published application window is open. */
export function isOpportunityPublic(
  opportunity: OpportunityVisibilityInput,
  now = new Date(),
): boolean {
  if (opportunity.state !== "PUBLISHED") return false;
  if (!opportunity.deadline) return true;

  const deadline =
    opportunity.deadline instanceof Date
      ? opportunity.deadline
      : new Date(opportunity.deadline);

  return !Number.isNaN(deadline.getTime()) && deadline >= now;
}

export interface PublicationVisibilityInput {
  state: string;
  stage: string;
  type: string;
  arxivId?: string | null;
}

export function isPublicationPublic(
  publication: PublicationVisibilityInput,
): boolean {
  if (publication.state !== "PUBLISHED") return false;

  return (
    PUBLICATION_PUBLIC_STAGES.some((stage) => stage === publication.stage) ||
    (publication.type === "PREPRINT" && Boolean(publication.arxivId?.trim()))
  );
}

export interface ScheduledVisibilityInput {
  state: string;
  publishAt?: Date | string | null;
}

export function isPublishedAndDue(
  record: ScheduledVisibilityInput,
  now = new Date(),
): boolean {
  if (record.state !== "PUBLISHED") return false;
  if (!record.publishAt) return true;

  const publishAt =
    record.publishAt instanceof Date
      ? record.publishAt
      : new Date(record.publishAt);

  return !Number.isNaN(publishAt.getTime()) && publishAt <= now;
}

/**
 * A progress update reaches the public only when it was marked public *and*
 * its project is. Both halves matter: publishing a project must not
 * retroactively publish the team's working notes.
 */
export const publicProjectUpdateWhere = {
  isPublic: true,
  project: publicProjectWhere,
} satisfies Prisma.ProjectUpdateWhereInput;

export interface ProjectResearchInput {
  resultsPublic: boolean;
  experiments?: string | null;
  results?: string | null;
}

/** Remove private research fields before a project crosses a public boundary. */
export function publicProjectResearch<T extends ProjectResearchInput>(
  project: T,
): Omit<T, "experiments" | "results"> & {
  experiments: string | null;
  results: string | null;
} {
  return {
    ...project,
    experiments: project.resultsPublic ? (project.experiments ?? null) : null,
    results: project.resultsPublic ? (project.results ?? null) : null,
  };
}
