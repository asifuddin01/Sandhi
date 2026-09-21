"use server";

import { revalidatePath } from "next/cache";

import {
  AdminActionError,
  invalidate,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import { cacheTags } from "@/lib/cache-tags";
import { getDb } from "@/lib/db";
import {
  isApprovalField,
  readFieldValue,
  type ApprovalField,
} from "@/lib/portal/profile-fields";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function pendingFor(memberId: string) {
  const changes = await getDb().changeRequest.findMany({
    where: { memberId, status: "PENDING" },
    select: { id: true, field: true, newValue: true },
  });
  if (changes.length === 0) {
    throw new AdminActionError("There is nothing waiting for this person.");
  }
  return changes;
}

/**
 * Applies everything a member asked for about their profile, in one
 * transaction with the record of who allowed it. Approving half of somebody's
 * changes would publish a profile that nobody wrote.
 */
export async function approveProfileChangesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const memberId = field(formData, "memberId");
  const result = await runAdminAction("approvals:manage", async (viewer) => {
    const changes = await pendingFor(memberId);
    const reviewerId = viewer.member?.id ?? null;

    const data: Record<string, unknown> = {};
    for (const change of changes) {
      if (!isApprovalField(change.field)) continue;
      data[change.field] = readFieldValue(
        change.field as ApprovalField,
        change.newValue,
      );
    }

    const member = await getDb().$transaction(async (transaction) => {
      const updated = await transaction.member.update({
        where: { id: memberId },
        data,
        select: { name: true, slug: true },
      });
      await transaction.changeRequest.updateMany({
        where: { id: { in: changes.map((change) => change.id) } },
        data: { status: "APPROVED", reviewerId, decidedAt: new Date() },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "member.profile_approved",
        entity: "Member",
        entityId: memberId,
        diff: { fields: changes.map((change) => change.field) },
      });
      return updated;
    });

    invalidate(cacheTags.members, cacheTags.research);
    revalidatePath(`/people/${member.slug}`);
    revalidatePath("/people");
    return {
      status: "success",
      message: `${member.name}'s profile is updated.`,
    };
  });
  revalidatePath("/admin/approvals");
  revalidatePath("/admin");
  revalidatePath("/portal/profile");
  return result;
}

/**
 * Refuses them. The profile is left exactly as the public page already shows
 * it, and the member is free to ask again.
 */
export async function rejectProfileChangesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const memberId = field(formData, "memberId");
  const result = await runAdminAction("approvals:manage", async (viewer) => {
    const changes = await pendingFor(memberId);
    const reviewerId = viewer.member?.id ?? null;

    const member = await getDb().$transaction(async (transaction) => {
      await transaction.changeRequest.updateMany({
        where: { id: { in: changes.map((change) => change.id) } },
        data: { status: "REJECTED", reviewerId, decidedAt: new Date() },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "member.profile_rejected",
        entity: "Member",
        entityId: memberId,
        diff: { fields: changes.map((change) => change.field) },
      });
      return transaction.member.findUniqueOrThrow({
        where: { id: memberId },
        select: { name: true },
      });
    });

    return {
      status: "success",
      message: `${member.name}'s profile is unchanged. Tell them why.`,
    };
  });
  revalidatePath("/admin/approvals");
  revalidatePath("/admin");
  revalidatePath("/portal/profile");
  return result;
}
