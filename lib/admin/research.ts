import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { parsePublishState } from "@/lib/content-state";
import { getDb } from "@/lib/db";

export const RESEARCH_PAGE_SIZE = 100;

export async function getThemesIndex(filters: {
  query?: string;
  state?: string;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const where: Prisma.ResearchThemeWhereInput = {
    ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    ...(state ? { state } : {}),
  };
  const themes = await getDb().researchTheme.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: RESEARCH_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      name: true,
      state: true,
      sortOrder: true,
      _count: { select: { areas: true } },
    },
  });
  return { themes, total: themes.length };
}

export async function getAreasIndex(filters: {
  query?: string;
  state?: string;
  theme?: string;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const where: Prisma.ResearchAreaWhereInput = {
    ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    ...(state ? { state } : {}),
    ...(filters.theme ? { themeId: filters.theme } : {}),
  };
  const areas = await getDb().researchArea.findMany({
    where,
    orderBy: [{ theme: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    take: RESEARCH_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      name: true,
      state: true,
      sortOrder: true,
      theme: { select: { name: true } },
      _count: {
        select: {
          projects: true,
          publications: true,
          members: true,
          resources: true,
        },
      },
    },
  });
  return { areas, total: areas.length };
}

export function getThemeOptions() {
  return getDb().researchTheme.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export function getThemeForEdit(id: string) {
  return getDb().researchTheme.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      gloss: true,
      overview: true,
      sortOrder: true,
      state: true,
    },
  });
}

export function getAreaForEdit(id: string) {
  return getDb().researchArea.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      overview: true,
      questions: true,
      sortOrder: true,
      state: true,
      themeId: true,
    },
  });
}
