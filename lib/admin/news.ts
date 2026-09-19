import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  parsePublishState,
  publicStatus,
  type PublishStateValue,
} from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/public-content";

export const NEWS_PAGE_SIZE = 50;

export function parseNewsCategory(value: unknown): NewsCategory | null {
  return NEWS_CATEGORIES.includes(value as NewsCategory)
    ? (value as NewsCategory)
    : null;
}

export async function getNewsIndex(filters: {
  query?: string;
  state?: string;
  category?: string;
  page?: number;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const category = parseNewsCategory(filters.category);
  const page = Math.min(1000, Math.max(1, filters.page ?? 1));

  const where: Prisma.NewsPostWhereInput = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { excerpt: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(state ? { state } : {}),
    ...(category ? { category } : {}),
  };

  const db = getDb();
  const [rows, total] = await Promise.all([
    db.newsPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * NEWS_PAGE_SIZE,
      take: NEWS_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        state: true,
        publishAt: true,
        updatedAt: true,
      },
    }),
    db.newsPost.count({ where }),
  ]);

  const now = new Date();
  return {
    posts: rows.map((row) => ({
      ...row,
      visibility: publicStatus(
        row.state as PublishStateValue,
        row.publishAt,
        now,
      ),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE)),
  };
}

export async function getNewsForEdit(id: string) {
  return getDb().newsPost.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      category: true,
      state: true,
      publishAt: true,
      authorId: true,
      projectId: true,
      publicationId: true,
      coverKey: true,
      coverAlt: true,
      updatedAt: true,
    },
  });
}

/** People, projects, and publications a post may be linked to. */
export async function getNewsLinkOptions() {
  const db = getDb();
  const [members, projects, publications] = await Promise.all([
    db.member.findMany({
      where: { status: { in: ["ACTIVE", "ALUMNI"] } },
      orderBy: { name: "asc" },
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
  return { members, projects, publications };
}
