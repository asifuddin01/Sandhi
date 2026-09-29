import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";

/**
 * A member's own research notes. Every read is keyed on the viewer's member
 * id rather than on an id from the request, so this file has no way to reach
 * somebody else's unpublished draft.
 *
 * A note is "theirs" when they are on its author list. Writing one and then
 * leaving yourself off it is a mistake the form prevents, not something this
 * has to allow for.
 */

/**
 * An author writes their note up to the point where they hand it over. Once
 * it is with the reviewers it stops being editable: letting the author keep
 * changing it underneath a review is how a review ends up approving a
 * version nobody read. A reviewer sending it back makes it a draft again.
 */
export const MEMBER_EDITABLE_STATES = ["DRAFT"] as const;

export function memberMayEdit(state: string): boolean {
  return (MEMBER_EDITABLE_STATES as readonly string[]).includes(state);
}

/** Only a draft can be sent to be read. */
export function memberMaySubmit(state: string): boolean {
  return state === "DRAFT";
}

export interface MemberInsightSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: string;
  state: string;
  publishedAt: Date | null;
  updatedAt: Date;
  /** Whether this viewer may still change it. */
  editable: boolean;
}

export interface MemberInsightDetail extends MemberInsightSummary {
  body: string;
  authors: Array<{ memberId: string; name: string; position: number }>;
}

export async function getMemberInsights(
  viewer: Viewer,
): Promise<MemberInsightSummary[]> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return [];

  const rows = await getDb().insight.findMany({
    where: { authors: { some: { memberId } } },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      kind: true,
      state: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  return rows.map((row) => ({ ...row, editable: memberMayEdit(row.state) }));
}

/**
 * One of their own. Returns null for a note they are not on, which is the
 * same answer as one that does not exist — the id tells them nothing either
 * way.
 */
export async function getMemberInsight(
  viewer: Viewer,
  id: string,
): Promise<MemberInsightDetail | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const row = await getDb().insight.findFirst({
    where: { id, authors: { some: { memberId } } },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      body: true,
      kind: true,
      state: true,
      publishedAt: true,
      updatedAt: true,
      authors: {
        orderBy: { position: "asc" },
        select: {
          memberId: true,
          position: true,
          member: { select: { name: true } },
        },
      },
    },
  });
  if (!row) return null;

  const { authors, ...insight } = row;
  return {
    ...insight,
    editable: memberMayEdit(row.state),
    authors: authors.map(({ member, ...author }) => ({
      ...author,
      name: member.name,
    })),
  };
}
