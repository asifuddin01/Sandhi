"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import {
  AdminActionError,
  invalidate,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import {
  changes,
  field,
  oneOf,
  optionalHttpsUrl,
  optionalText,
  requiredText,
  runBulk,
} from "@/lib/admin/content-actions";
import { cacheTags } from "@/lib/cache-tags";
import { unscheduledStates } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { PARTNER_KINDS } from "@/lib/partner-content";

function readPartner(formData: FormData) {
  const sortOrder = Number(field(formData, "sortOrder") || "0");
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
    throw new AdminActionError(
      "Use a whole number from 0 to 999 for the order.",
    );
  }
  return {
    name: requiredText(formData, "name", "a name", 200),
    kind: oneOf(field(formData, "kind"), PARTNER_KINDS, "Choose a kind."),
    description: requiredText(formData, "description", "a description", 600),
    relationship: optionalText(
      formData,
      "relationship",
      "the relationship",
      200,
    ),
    url: optionalHttpsUrl(formData, "url", "The website"),
    sortOrder,
    state: oneOf(
      field(formData, "state"),
      unscheduledStates,
      "Choose a state.",
    ),
  };
}

export async function savePartnerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("partners:manage", async (viewer) => {
    const data = readPartner(formData);
    const db = getDb();
    if (!id) {
      const created = await db.$transaction(async (transaction) => {
        const partner = await transaction.partner.create({
          data,
          select: { id: true },
        });
        await recordAudit(transaction, {
          actorId: viewer.userId,
          action: "partner.create",
          entity: "Partner",
          entityId: partner.id,
          diff: { name: data.name, state: data.state },
        });
        return partner;
      });
      createdId = created.id;
    } else {
      const before = await db.partner.findUnique({ where: { id } });
      if (!before) throw new AdminActionError("That partner no longer exists.");
      const diff = changes(before, data);
      if (Object.keys(diff).length === 0) {
        return { status: "success", message: "Nothing changed." };
      }
      await db.$transaction(async (transaction) => {
        await transaction.partner.update({ where: { id }, data });
        await recordAudit(transaction, {
          actorId: viewer.userId,
          action: "partner.update",
          entity: "Partner",
          entityId: id,
          diff: diff as Prisma.InputJsonValue,
        });
      });
    }
    invalidate(cacheTags.partners);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/partners");
  if (createdId) redirect(`/admin/partners/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/partners/${id}`);
  return result;
}

export async function bulkPartnersAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("partners:manage", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "Partner",
      prefix: "partner",
      noun: { one: "partner", many: "partners" },
      load: (ids) =>
        getDb().partner.findMany({
          where: { id: { in: ids } },
          select: { id: true, state: true },
        }),
      update: (transaction, id, data) =>
        transaction.partner.update({ where: { id }, data }),
      remove: (transaction, id) =>
        transaction.partner.delete({ where: { id } }),
    });
    invalidate(cacheTags.partners);
    return outcome;
  });
  revalidatePath("/admin/partners");
  return result;
}
