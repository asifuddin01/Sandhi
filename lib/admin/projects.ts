import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { parsePublishState } from "@/lib/content-state";
import { getDb } from "@/lib/db";

export const PROJECT_STATUSES = [
  "PROPOSED",
  "ACTIVE",
  "COMPLETED",
  "SUBMITTED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PAGE_SIZE = 50;

export async function getProjectsIndex(filters: {
  query?: string;
  state?: string;
  status?: string;
  page?: number;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const status = PROJECT_STATUSES.find((value) => value === filters.status);
  const page = Math.min(1000, Math.max(1, filters.page ?? 1));
  const where: Prisma.ProjectWhereInput = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(state ? { state } : {}),
    ...(status ? { status } : {}),
  };
  const db = getDb();
  const [projects, total] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PROJECT_PAGE_SIZE,
      take: PROJECT_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        state: true,
        featured: true,
        updatedAt: true,
        _count: { select: { members: true } },
      },
    }),
    db.project.count({ where }),
  ]);
  return {
    projects,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PROJECT_PAGE_SIZE)),
  };
}

export function getProjectForEdit(id: string) {
  return getDb().project.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      gloss: true,
      abstract: true,
      question: true,
      motivation: true,
      approach: true,
      experiments: true,
      results: true,
      resultsPublic: true,
      status: true,
      state: true,
      featured: true,
      codeUrl: true,
      datasetUrl: true,
      demoUrl: true,
      startedAt: true,
      endedAt: true,
      areas: { select: { areaId: true } },
      members: {
        orderBy: { sortOrder: "asc" },
        select: { memberId: true, role: true, isLead: true },
      },
      relatedFrom: { select: { toId: true } },
    },
  });
}

export async function getProjectOptions(excludeId?: string) {
  const db = getDb();
  const [areas, members, projects] = await Promise.all([
    db.researchArea.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.member.findMany({
      where: { status: { in: ["ACTIVE", "ALUMNI"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.project.findMany({
      where: excludeId ? { id: { not: excludeId } } : {},
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);
  return { areas, members, projects };
}
