import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";

/**
 * Research notes as a reviewer sees them: what has been handed over and is
 * waiting to be read, what is still being written, and what is already out.
 *
 * Reviewers see every note, drafts included. That is the difference between
 * this and `lib/portal/insights.ts`, which can only ever see the viewer's
 * own.
 */

export const QUEUE_LIMIT = 100;

export interface InsightQueueRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: string;
  state: string;
  publishedAt: Date | null;
  updatedAt: Date;
  authors: string[];
}

export interface InsightQueue {
  inReview: InsightQueueRow[];
  drafts: InsightQueueRow[];
  published: InsightQueueRow[];
}

const SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  kind: true,
  state: true,
  publishedAt: true,
  updatedAt: true,
  authors: {
    orderBy: { position: "asc" },
    select: { member: { select: { name: true } } },
  },
} as const;

type Row = Omit<InsightQueueRow, "authors"> & {
  authors: Array<{ member: { name: string } }>;
};

function shape(row: Row): InsightQueueRow {
  return {
    ...row,
    authors: row.authors.map((author) => author.member.name),
  };
}

export async function getInsightQueue(): Promise<InsightQueue> {
  if (!isDatabaseConfigured()) {
    return { inReview: [], drafts: [], published: [] };
  }

  const rows = await getDb().insight.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: QUEUE_LIMIT,
    select: SELECT,
  });

  const shaped = rows.map((row) => shape(row as Row));
  return {
    inReview: shaped.filter((row) => row.state === "IN_REVIEW"),
    drafts: shaped.filter((row) => row.state === "DRAFT"),
    // Archived notes sit here too: they are the ones that have been out.
    published: shaped.filter((row) =>
      ["PUBLISHED", "SCHEDULED", "ARCHIVED"].includes(row.state),
    ),
  };
}

export interface InsightDecision {
  insightId: string;
  /** Null when the note has been deleted since. */
  title: string | null;
  from: string;
  to: string;
  by: string | null;
  at: Date;
}

/**
 * What has been decided recently, read back from the audit log.
 *
 * A decision moves a note from one list on the page to another, so the form
 * that made it unmounts and its "done" message goes with it. This is the
 * durable record in its place: press a button, and the page still says what
 * happened afterwards.
 */
export async function getRecentInsightDecisions(
  since = new Date(Date.now() - 24 * 60 * 60 * 1000),
): Promise<InsightDecision[]> {
  if (!isDatabaseConfigured()) return [];

  const entries = await getDb().auditLog.findMany({
    where: { action: "insight.state_changed", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      entityId: true,
      diff: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
  if (entries.length === 0) return [];

  const notes = await getDb().insight.findMany({
    where: { id: { in: entries.map((entry) => entry.entityId) } },
    select: { id: true, title: true },
  });
  const titleOf = new Map(notes.map((note) => [note.id, note.title]));

  return entries.map((entry) => {
    const diff = (entry.diff ?? {}) as { from?: string; to?: string };
    return {
      insightId: entry.entityId,
      title: titleOf.get(entry.entityId) ?? null,
      from: diff.from ?? "",
      to: diff.to ?? "",
      by: entry.actor?.name ?? null,
      at: entry.createdAt,
    };
  });
}
