import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  isPosted,
  PROPOSAL_STATUSES,
  type ProposalStatusValue,
} from "@/lib/proposals";

/**
 * The review side of proposals. Everything here is behind
 * `proposals:review`, and nothing on it is public: a proposal is somebody's
 * unpublished idea until the lab decides to take it up.
 */

export const PROPOSALS_PAGE_SIZE = 25;

const listSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  status: true,
  createdAt: true,
  proposerName: true,
  area: { select: { slug: true, name: true } },
  reviewer: { select: { name: true } },
  _count: { select: { interests: true } },
} as const;

export interface ProposalsIndex {
  proposals: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string;
    status: string;
    createdAt: Date;
    proposerName: string;
    area: { slug: string; name: string } | null;
    reviewer: { name: string } | null;
    interested: number;
  }>;
  total: number;
  page: number;
  pages: number;
  /** How many sit in each state, for the filter row. */
  counts: Record<string, number>;
}

export async function getProposalsIndex({
  status,
  query,
  page = 1,
}: {
  status?: string;
  query?: string;
  page?: number;
}): Promise<ProposalsIndex> {
  const empty: ProposalsIndex = {
    proposals: [],
    total: 0,
    page: 1,
    pages: 1,
    counts: {},
  };
  if (!isDatabaseConfigured()) return empty;

  const db = getDb();
  const wanted = (PROPOSAL_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as ProposalStatusValue)
    : undefined;
  const text = query?.trim();

  const where = {
    ...(wanted ? { status: wanted } : {}),
    ...(text
      ? {
          OR: [
            { title: { contains: text, mode: "insensitive" as const } },
            { summary: { contains: text, mode: "insensitive" as const } },
            { proposerName: { contains: text, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const current = Math.max(1, page);
  const [rows, total, grouped] = await Promise.all([
    db.proposal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PROPOSALS_PAGE_SIZE,
      take: PROPOSALS_PAGE_SIZE,
      select: listSelect,
    }),
    db.proposal.count({ where }),
    db.proposal.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return {
    proposals: rows.map(({ _count, ...row }) => ({
      ...row,
      interested: _count.interests,
    })),
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / PROPOSALS_PAGE_SIZE)),
    counts: Object.fromEntries(
      grouped.map((group) => [group.status, group._count._all]),
    ),
  };
}

export async function getProposal(id: string) {
  if (!isDatabaseConfigured()) return null;

  return getDb().proposal.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      question: true,
      approach: true,
      outcome: true,
      status: true,
      decisionNote: true,
      decidedAt: true,
      decisionSentAt: true,
      createdAt: true,
      proposerName: true,
      proposerEmail: true,
      proposerAffiliation: true,
      proposer: { select: { slug: true, name: true } },
      reviewer: { select: { name: true } },
      decidedBy: { select: { name: true } },
      area: { select: { id: true, slug: true, name: true } },
      project: { select: { slug: true, title: true } },
      interests: {
        orderBy: { createdAt: "asc" },
        select: {
          note: true,
          createdAt: true,
          member: { select: { id: true, slug: true, name: true, rank: true } },
        },
      },
    },
  });
}

export type ProposalDetail = NonNullable<
  Awaited<ReturnType<typeof getProposal>>
>;

/** Proposals the lab can see and mark interest in. */
export async function getPostedProposals() {
  if (!isDatabaseConfigured()) return [];

  return getDb().proposal.findMany({
    where: { status: { in: ["QUEUED", "APPROVED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      createdAt: true,
      proposerName: true,
      area: { select: { slug: true, name: true } },
      project: { select: { slug: true } },
      interests: {
        select: {
          note: true,
          memberId: true,
          member: { select: { slug: true, name: true } },
        },
      },
    },
  });
}

export { isPosted };
