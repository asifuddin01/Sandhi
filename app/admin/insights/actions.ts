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

/**
 * Deciding what happens to a research note somebody handed over.
 *
 * One action rather than three, because publishing, sending back and
 * withdrawing differ only in the state they land on — and a single list of
 * allowed moves is easier to read than three functions that each imply one.
 */

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Where a note may go from where it is. A reviewer cannot send a published
 * note back into review: it is already out, and the honest move is to
 * withdraw it and let the author start again.
 */
const MOVES: Record<string, readonly string[]> = {
  DRAFT: ["PUBLISHED"],
  IN_REVIEW: ["PUBLISHED", "DRAFT"],
  SCHEDULED: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["PUBLISHED"],
};

const WORDS: Record<string, string> = {
  PUBLISHED: "published",
  DRAFT: "sent back to its author",
  ARCHIVED: "withdrawn",
};

export async function decideInsightAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "insightId");
  const next = field(formData, "state");

  const result = await runAdminAction("content:manage", async (viewer) => {
    const insight = await getDb().insight.findUnique({
      where: { id },
      select: { state: true, slug: true, title: true, publishedAt: true },
    });
    if (!insight) throw new AdminActionError("That note is gone.");

    if (!(MOVES[insight.state] ?? []).includes(next)) {
      throw new AdminActionError("That is not a move this note can make.");
    }

    await getDb().$transaction(async (transaction) => {
      await transaction.insight.update({
        where: { id },
        data: {
          state: next as never,
          // The publication date is set once, the first time it goes out.
          // Withdrawing and republishing does not make it new again.
          publishedAt:
            next === "PUBLISHED" && !insight.publishedAt
              ? new Date()
              : insight.publishedAt,
        },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "insight.state_changed",
        entity: "Insight",
        entityId: id,
        diff: { from: insight.state, to: next },
      });
    });

    invalidate(cacheTags.insights);
    revalidatePath("/insights");
    revalidatePath(`/insights/${insight.slug}`);
    // The author is watching this state from their own page.
    revalidatePath("/portal/insights");
    revalidatePath(`/portal/insights/${id}`);

    return {
      status: "success",
      message: `“${insight.title}” is ${WORDS[next] ?? next.toLowerCase()}.`,
    };
  });

  revalidatePath("/admin/insights");
  return result;
}
