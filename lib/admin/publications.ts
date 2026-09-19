import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  parsePublishState,
  publicStatus,
  type PublishStateValue,
} from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { parsePublicationStage } from "@/lib/publications";
import { isPublicationPublic } from "@/lib/visibility";

export const PUBLICATIONS_PAGE_SIZE = 50;

export async function getPublicationsIndex(filters: {
  query?: string;
  state?: string;
  stage?: string;
  page?: number;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const stage = parsePublicationStage(filters.stage);
  const page = Math.min(1000, Math.max(1, filters.page ?? 1));

  const where: Prisma.PublicationWhereInput = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            { venueName: { contains: query, mode: "insensitive" } },
            { doi: { contains: query, mode: "insensitive" } },
            { arxivId: { contains: query, mode: "insensitive" } },
            // Kept up to date by a database trigger on PublicationAuthor.
            { searchAuthors: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(state ? { state } : {}),
    ...(stage ? { stage } : {}),
  };

  const db = getDb();
  const [rows, total, inReview] = await Promise.all([
    db.publication.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PUBLICATIONS_PAGE_SIZE,
      take: PUBLICATIONS_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        stage: true,
        state: true,
        year: true,
        arxivId: true,
        venueShort: true,
        venueName: true,
        updatedAt: true,
      },
    }),
    db.publication.count({ where }),
    db.publication.count({ where: { stage: "INTERNAL_REVIEW" } }),
  ]);

  return {
    publications: rows.map((row) => ({
      ...row,
      visibility: publicStatus(row.state as PublishStateValue, null),
      // A record can be published on the site and still be a preprint, so the
      // list states whether visitors can actually reach it.
      public: isPublicationPublic(row),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PUBLICATIONS_PAGE_SIZE)),
    inReview,
  };
}

export async function getPublicationForEdit(id: string) {
  const publication = await getDb().publication.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      abstract: true,
      type: true,
      stage: true,
      state: true,
      venueName: true,
      venueShort: true,
      year: true,
      publishedAt: true,
      doi: true,
      arxivId: true,
      pdfUrl: true,
      codeUrl: true,
      datasetUrl: true,
      pageUrl: true,
      bibtexOverride: true,
      award: true,
      featured: true,
      projectId: true,
      updatedAt: true,
      authors: {
        orderBy: { position: "asc" },
        select: {
          memberId: true,
          externalName: true,
          externalAffiliation: true,
          equalContribution: true,
          corresponding: true,
        },
      },
      areas: { select: { areaId: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          comment: true,
          decision: true,
          createdAt: true,
          reviewer: { select: { name: true } },
        },
      },
      _count: { select: { resources: true, newsPosts: true } },
    },
  });
  if (!publication) return null;

  const { areas, ...rest } = publication;
  return { ...rest, areaIds: areas.map((area) => area.areaId) };
}

/** People, projects, and areas a publication can be linked to. */
export async function getPublicationLinkOptions() {
  const db = getDb();
  const [members, projects, areas] = await Promise.all([
    db.member.findMany({
      where: { status: { in: ["ACTIVE", "ALUMNI"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.project.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    db.researchArea.findMany({
      orderBy: [{ theme: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: { id: true, name: true, theme: { select: { name: true } } },
    }),
  ]);
  return { members, projects, areas };
}
