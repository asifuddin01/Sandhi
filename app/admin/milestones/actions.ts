"use server";

import { revalidatePath } from "next/cache";

import {
  AdminActionError,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import { field, requiredText } from "@/lib/admin/content-actions";
import { getDb } from "@/lib/db";
import { isDay } from "@/lib/intake";

const MAX_BODY = 600;

/**
 * The lab's timeline on the About page. It is kept from that page's own
 * administration bar; there is no screen for it in administration.
 */
export async function addMilestoneAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("settings:manage", async (viewer) => {
    const day = field(formData, "date");
    if (!isDay(day)) throw new AdminActionError("Choose the date.");
    const title = requiredText(formData, "title", "a title", 160);
    const body = field(formData, "body").trim();
    if (body.length > MAX_BODY) {
      throw new AdminActionError(
        `Keep the description under ${MAX_BODY} characters.`,
      );
    }

    await getDb().$transaction(async (transaction) => {
      const milestone = await transaction.milestone.create({
        data: {
          date: new Date(`${day}T00:00:00Z`),
          title,
          body: body || null,
        },
        select: { id: true },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "milestone.create",
        entity: "Milestone",
        entityId: milestone.id,
        diff: { date: day, title },
      });
    });
    return { status: "success", message: "Added to the timeline." };
  });

  revalidatePath("/about");
  return result;
}

export async function removeMilestoneAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "milestoneId");
  const result = await runAdminAction("settings:manage", async (viewer) => {
    const milestone = await getDb().milestone.findUnique({ where: { id } });
    if (!milestone) throw new AdminActionError("That entry is already gone.");

    await getDb().$transaction(async (transaction) => {
      await transaction.milestone.delete({ where: { id } });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "milestone.delete",
        entity: "Milestone",
        entityId: id,
        // Kept in the audit entry, since the row itself is gone.
        diff: {
          date: milestone.date.toISOString().slice(0, 10),
          title: milestone.title,
          body: milestone.body,
        },
      });
    });
    return {
      status: "success",
      message: `“${milestone.title}” was removed from the timeline.`,
    };
  });

  revalidatePath("/about");
  return result;
}
