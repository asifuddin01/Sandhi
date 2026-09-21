import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";

/**
 * A member's own publications. Everything here is keyed on the viewer's
 * member id rather than on an id from the request, so this file has no way
 * to read somebody else's unpublished paper.
 *
 * A paper is "theirs" when they are on its author list. Recording one and
 * then leaving yourself off it is a mistake the form prevents, not something
 * this has to allow for.
 */

/**
 * A member writes their own paper up to the point where the lab takes over.
 * Once it is in internal review it belongs to the reviewers: letting an
 * author keep editing underneath them is how a review ends up approving a
 * version nobody read.
 */
export const MEMBER_EDITABLE_STAGES = ["DRAFT"] as const;

export function memberMayEdit(stage: string): boolean {
  return (MEMBER_EDITABLE_STAGES as readonly string[]).includes(stage);
}

/** Only a draft can be sent for review, and only once. */
export function memberMaySubmit(stage: string): boolean {
  return stage === "DRAFT";
}

export interface MemberPublicationSummary {
  id: string;
  slug: string;
  title: string;
  type: string;
  stage: string;
  state: string;
  venueName: string | null;
  year: number | null;
  updatedAt: Date;
  /** Whether this viewer may still change it. */
  editable: boolean;
}

export async function getMemberPublications(
  viewer: Viewer,
): Promise<MemberPublicationSummary[]> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return [];

  const rows = await getDb().publication.findMany({
    where: { authors: { some: { memberId } } },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      stage: true,
      state: true,
      venueName: true,
      year: true,
      updatedAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    editable: memberMayEdit(row.stage),
  }));
}

export interface MemberPublicationDetail extends MemberPublicationSummary {
  abstract: string;
  venueShort: string | null;
  doi: string | null;
  arxivId: string | null;
  pdfUrl: string | null;
  codeUrl: string | null;
  datasetUrl: string | null;
  pageUrl: string | null;
  authors: Array<{
    position: number;
    memberId: string | null;
    memberName: string | null;
    externalName: string | null;
    externalAffiliation: string | null;
    equalContribution: boolean;
    corresponding: boolean;
  }>;
  reviews: Array<{
    id: string;
    decision: string;
    comment: string;
    reviewer: string | null;
    createdAt: Date;
  }>;
}

/**
 * One of their own. Returns null for a paper they are not on, which is the
 * same answer as one that does not exist — the id tells them nothing either
 * way.
 */
export async function getMemberPublication(
  viewer: Viewer,
  id: string,
): Promise<MemberPublicationDetail | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const row = await getDb().publication.findFirst({
    where: { id, authors: { some: { memberId } } },
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
      doi: true,
      arxivId: true,
      pdfUrl: true,
      codeUrl: true,
      datasetUrl: true,
      pageUrl: true,
      updatedAt: true,
      authors: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          memberId: true,
          externalName: true,
          externalAffiliation: true,
          equalContribution: true,
          corresponding: true,
          member: { select: { name: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          decision: true,
          comment: true,
          createdAt: true,
          reviewer: { select: { name: true } },
        },
      },
    },
  });
  if (!row) return null;

  const { authors, reviews, ...publication } = row;
  return {
    ...publication,
    editable: memberMayEdit(row.stage),
    authors: authors.map(({ member, ...author }) => ({
      ...author,
      memberName: member?.name ?? null,
    })),
    reviews: reviews.map(({ reviewer, ...review }) => ({
      ...review,
      reviewer: reviewer?.name ?? null,
    })),
  };
}

/** Everyone who can be named as an author from inside the lab. */
export async function authorableMembers(): Promise<
  Array<{ id: string; name: string }>
> {
  if (!isDatabaseConfigured()) return [];
  return getDb().member.findMany({
    where: { status: { in: ["ACTIVE", "ALUMNI"] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}
