import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  estimateInsightReadingMinutes,
  extractInsightHeadings,
  INSIGHT_KINDS,
  type InsightHeading,
  type InsightKind,
} from "@/lib/insight-content";
import { publicInsightWhere, publicMemberWhere } from "@/lib/visibility";

export interface PublicInsightSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: InsightKind;
  publishedAt: Date | null;
  createdAt: Date;
  readingMinutes: number;
  authors: Array<{ name: string; slug: string }>;
}

export interface PublicInsightDetail extends PublicInsightSummary {
  body: string;
  updatedAt: Date;
  headings: InsightHeading[];
}

const insightSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  body: true,
  kind: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  authors: {
    where: { member: publicMemberWhere },
    orderBy: { position: "asc" },
    select: { member: { select: { name: true, slug: true } } },
  },
} satisfies Prisma.InsightSelect;

type InsightRow = Prisma.InsightGetPayload<{ select: typeof insightSelect }>;

function mapInsight(row: InsightRow): PublicInsightDetail {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    kind: row.kind,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    readingMinutes: estimateInsightReadingMinutes(row.body),
    headings: extractInsightHeadings(row.body),
    authors: row.authors.map(({ member }) => member),
  };
}

export async function getPublicInsights(
  requestedKind?: string,
): Promise<PublicInsightSummary[]> {
  if (!isDatabaseConfigured()) return [];
  const kind = INSIGHT_KINDS.find((item) => item === requestedKind);
  const rows = await getDb().insight.findMany({
    where: {
      AND: [publicInsightWhere, ...(kind ? [{ kind }] : [])],
    },
    orderBy: [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: insightSelect,
  });

  return rows.map(mapInsight);
}

export const getPublicInsightBySlug = cache(
  async (slug: string): Promise<PublicInsightDetail | null> => {
    if (!isDatabaseConfigured()) return null;
    const row = await getDb().insight.findFirst({
      where: { AND: [publicInsightWhere, { slug }] },
      select: insightSelect,
    });

    return row ? mapInsight(row) : null;
  },
);
