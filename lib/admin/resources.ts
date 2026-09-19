import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { parsePublishState } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { RESOURCE_KINDS } from "@/lib/public-resources";

export const RESOURCE_PAGE_SIZE = 50;

export async function getResourcesIndex(filters: {
  query?: string;
  state?: string;
  kind?: string;
  page?: number;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const kind = RESOURCE_KINDS.find((value) => value === filters.kind);
  const page = Math.min(1000, Math.max(1, filters.page ?? 1));
  const where: Prisma.ResourceWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(state ? { state } : {}),
    ...(kind ? { kind } : {}),
  };
  const db = getDb();
  const [resources, total] = await Promise.all([
    db.resource.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * RESOURCE_PAGE_SIZE,
      take: RESOURCE_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        state: true,
        updatedAt: true,
      },
    }),
    db.resource.count({ where }),
  ]);
  return {
    resources,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / RESOURCE_PAGE_SIZE)),
  };
}

export function getResourceForEdit(id: string) {
  return getDb().resource.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      description: true,
      license: true,
      version: true,
      downloadUrl: true,
      repoUrl: true,
      docsUrl: true,
      hfUrl: true,
      bibtex: true,
      changelog: true,
      projectId: true,
      publicationId: true,
      state: true,
      areas: { select: { areaId: true } },
    },
  });
}

export async function getResourceLinkOptions() {
  const db = getDb();
  const [areas, projects, publications] = await Promise.all([
    db.researchArea.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.project.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    db.publication.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);
  return { areas, projects, publications };
}
