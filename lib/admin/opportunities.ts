import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { parsePublishState } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { OPPORTUNITY_KINDS } from "@/lib/public-opportunities";

export const OPPORTUNITY_PAGE_SIZE = 50;

export async function getOpportunitiesIndex(filters: {
  query?: string;
  state?: string;
  kind?: string;
  page?: number;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const kind = OPPORTUNITY_KINDS.find((value) => value === filters.kind);
  const page = Math.min(1000, Math.max(1, filters.page ?? 1));
  const where: Prisma.OpportunityWhereInput = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(state ? { state } : {}),
    ...(kind ? { kind } : {}),
  };
  const db = getDb();
  const [opportunities, total] = await Promise.all([
    db.opportunity.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * OPPORTUNITY_PAGE_SIZE,
      take: OPPORTUNITY_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        kind: true,
        state: true,
        deadline: true,
        _count: { select: { applications: true } },
      },
    }),
    db.opportunity.count({ where }),
  ]);
  return {
    opportunities,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / OPPORTUNITY_PAGE_SIZE)),
  };
}

export function getOpportunityForEdit(id: string) {
  return getDb().opportunity.findUnique({
    where: { id },
    select: {
      id: true,
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
      state: true,
      _count: { select: { applications: true } },
    },
  });
}

export function getResearchAreaOptions() {
  return getDb().researchArea.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true },
  });
}
