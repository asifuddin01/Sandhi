import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  isApprovalField,
  type ApprovalField,
} from "@/lib/portal/profile-fields";

/**
 * Profile changes a member has asked for on a published profile. Behind
 * `approvals:manage`, and never public: until one is approved the site goes
 * on showing what it showed before.
 */

export interface PendingProfileChange {
  memberId: string;
  memberName: string;
  memberSlug: string;
  asked: Date;
  changes: Array<{
    id: string;
    field: ApprovalField;
    oldValue: string;
    newValue: string;
  }>;
}

export async function getPendingProfileChanges(): Promise<
  PendingProfileChange[]
> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb().changeRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      field: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      member: { select: { id: true, name: true, slug: true } },
    },
  });

  // Grouped by person: an administrator decides about somebody's profile,
  // not about eleven unrelated fields in a list.
  const people = new Map<string, PendingProfileChange>();
  for (const row of rows) {
    if (!isApprovalField(row.field)) continue;
    const existing = people.get(row.member.id);
    const change = {
      id: row.id,
      field: row.field as ApprovalField,
      oldValue: row.oldValue ?? "",
      newValue: row.newValue,
    };
    if (existing) {
      existing.changes.push(change);
      continue;
    }
    people.set(row.member.id, {
      memberId: row.member.id,
      memberName: row.member.name,
      memberSlug: row.member.slug,
      asked: row.createdAt,
      changes: [change],
    });
  }
  return [...people.values()];
}

export interface DecidedProfileChange {
  memberName: string;
  memberSlug: string;
  approved: boolean;
  decidedAt: Date;
  reviewer: string | null;
  fields: ApprovalField[];
}

/**
 * What was decided lately, grouped by person.
 *
 * Deciding makes the person's block disappear from the queue, and a form
 * that unmounts takes its own message with it — so the confirmation cannot
 * live in the form. It lives here instead, in state that outlasts the
 * redraw, which is also what somebody wants when they come back and ask
 * "did I already do that one?".
 */
export async function getDecidedProfileChanges(
  since = new Date(Date.now() - 24 * 60 * 60 * 1000),
): Promise<DecidedProfileChange[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb().changeRequest.findMany({
    where: { status: { not: "PENDING" }, decidedAt: { gte: since } },
    orderBy: { decidedAt: "desc" },
    select: {
      field: true,
      status: true,
      decidedAt: true,
      member: { select: { name: true, slug: true } },
      reviewer: { select: { name: true } },
    },
  });

  const decisions = new Map<string, DecidedProfileChange>();
  for (const row of rows) {
    if (!isApprovalField(row.field) || !row.decidedAt) continue;
    const key = `${row.member.slug}:${row.status}:${row.decidedAt.getTime()}`;
    const existing = decisions.get(key);
    if (existing) {
      existing.fields.push(row.field as ApprovalField);
      continue;
    }
    decisions.set(key, {
      memberName: row.member.name,
      memberSlug: row.member.slug,
      approved: row.status === "APPROVED",
      decidedAt: row.decidedAt,
      reviewer: row.reviewer?.name ?? null,
      fields: [row.field as ApprovalField],
    });
  }
  return [...decisions.values()].slice(0, 10);
}
