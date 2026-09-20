"use server";

import { revalidatePath } from "next/cache";

import { cacheTags } from "@/lib/cache-tags";
import { invalidate } from "@/lib/admin/actions";
import { getDb } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";
import { isPosted, MAX_INTEREST_NOTE } from "@/lib/proposals";

import {
  field,
  ProgressError,
  run,
  type ProgressState,
} from "../projects/action-runtime";

/**
 * Saying you would work on a proposal. Interest is how a team is formed here,
 * so it is a member's own decision and their own to withdraw — nobody is
 * signed up by anyone else.
 */
export async function markInterestAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const proposalId = field(formData, "proposalId");
  const interested = field(formData, "interested") === "yes";
  const note = field(formData, "note").trim();

  const result = await run(async (viewer) => {
    const memberId = workspaceMemberId(viewer)!;
    const db = getDb();

    const proposal = await db.proposal.findUnique({
      where: { id: proposalId },
      select: { status: true, title: true },
    });
    if (!proposal) throw new ProgressError("That proposal is gone.");
    if (!isPosted(proposal.status)) {
      // An idea still under review is not an invitation.
      throw new ProgressError("That proposal is not open for interest.");
    }
    if (note.length > MAX_INTEREST_NOTE) {
      throw new ProgressError("Keep your note shorter.");
    }

    if (interested) {
      await db.proposalInterest.upsert({
        where: { proposalId_memberId: { proposalId, memberId } },
        update: { note: note || null },
        create: { proposalId, memberId, note: note || null },
      });
    } else {
      await db.proposalInterest.deleteMany({
        where: { proposalId, memberId },
      });
    }

    invalidate(cacheTags.proposals);
    return {
      status: "success",
      message: interested
        ? `You are in on ${proposal.title}.`
        : "Taken off the list.",
    };
  });

  revalidatePath("/portal/proposals");
  revalidatePath("/admin/proposals");
  return result;
}
