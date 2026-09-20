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
import { slugify } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";
import {
  canApprove,
  canMove,
  MAX_DECISION_NOTE,
  REVIEW_TRANSITIONS,
  type ReviewMove,
} from "@/lib/proposals";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function note(formData: FormData): string | null {
  const value = field(formData, "decisionNote").trim();
  if (value.length > MAX_DECISION_NOTE) {
    throw new AdminActionError("That note is too long to save.");
  }
  return value || null;
}

/**
 * A reviewer takes a proposal, queues it, or sends it back. Approving is not
 * here: it creates a project and a team, so it belongs to an administrator.
 */
export async function reviewProposalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const move = field(formData, "move") as ReviewMove;

  const result = await runAdminAction("proposals:review", async (viewer) => {
    if (!(move in REVIEW_TRANSITIONS)) {
      throw new AdminActionError("That is not something to do with it.");
    }

    const db = getDb();
    const proposal = await db.proposal.findUnique({
      where: { id },
      select: { status: true, title: true },
    });
    if (!proposal) throw new AdminActionError("That proposal is gone.");
    if (!canMove(proposal.status, move)) {
      throw new AdminActionError(
        `A proposal that is ${proposal.status.toLowerCase().replace("_", " ")} cannot be ${move}d.`,
      );
    }

    const reviewerId = workspaceMemberId(viewer);
    const next = REVIEW_TRANSITIONS[move].to;

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: {
          status: next,
          reviewerId,
          decisionNote: note(formData),
          ...(move === "decline" ? { decidedAt: new Date() } : {}),
        },
      });
      await recordAudit(tx, {
        actorId: viewer.userId,
        action: `proposal.${move}`,
        entity: "Proposal",
        entityId: id,
        diff: { from: proposal.status, to: next },
      });
    });

    invalidate(cacheTags.proposals);
    return {
      status: "success",
      message:
        move === "queue"
          ? "Queued. The lab can see it and say who is in."
          : move === "decline"
            ? "Sent back. The reason is on the record."
            : "Taken. It is yours to read.",
    };
  });

  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${id}`);
  revalidatePath("/portal/proposals");
  return result;
}

/**
 * Approving a proposal is the moment it becomes work: a project is created
 * from it, everyone who said they were interested joins the team, and the
 * proposal keeps a link to what it became. One transaction, so a half-made
 * project cannot outlive a failure.
 */
export async function approveProposalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const leadMemberId = field(formData, "leadMemberId").trim() || null;

  const result = await runAdminAction("proposals:approve", async (viewer) => {
    const db = getDb();
    const proposal = await db.proposal.findUnique({
      where: { id },
      select: {
        status: true,
        slug: true,
        title: true,
        summary: true,
        question: true,
        approach: true,
        outcome: true,
        areaId: true,
        projectId: true,
        interests: { select: { memberId: true } },
      },
    });
    if (!proposal) throw new AdminActionError("That proposal is gone.");
    if (proposal.projectId) {
      throw new AdminActionError("It is already a project.");
    }
    if (!canApprove(proposal.status)) {
      throw new AdminActionError("That proposal cannot be approved from here.");
    }

    const interested = proposal.interests.map((row) => row.memberId);
    if (leadMemberId && !interested.includes(leadMemberId)) {
      throw new AdminActionError(
        "Name a lead from the people who said they are interested.",
      );
    }

    const decisionNote = note(formData);
    const slug = await freeProjectSlug(
      proposal.slug || slugify(proposal.title),
    );

    const project = await db.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          slug,
          title: proposal.title,
          gloss: proposal.summary.slice(0, 200),
          abstract: proposal.summary,
          question: proposal.question,
          approach: proposal.approach,
          motivation: proposal.outcome,
          status: "PROPOSED",
          // Approved, not announced. An administrator publishes the project
          // when there is something to show.
          state: "DRAFT",
          ...(proposal.areaId
            ? { areas: { create: { areaId: proposal.areaId } } }
            : {}),
          members: {
            create: interested.map((memberId, index) => ({
              memberId,
              role: memberId === leadMemberId ? "Research Lead" : "Researcher",
              isLead: memberId === leadMemberId,
              sortOrder: index,
            })),
          },
        },
        select: { id: true, slug: true },
      });

      await tx.proposal.update({
        where: { id },
        data: {
          status: "APPROVED",
          projectId: created.id,
          decidedById: workspaceMemberId(viewer),
          decidedAt: new Date(),
          decisionNote,
        },
      });

      await recordAudit(tx, {
        actorId: viewer.userId,
        action: "proposal.approve",
        entity: "Proposal",
        entityId: id,
        diff: { projectId: created.id, team: interested.length },
      });

      return created;
    });

    invalidate(cacheTags.proposals, cacheTags.projects);
    return {
      status: "success",
      message: `Approved. It is now the project /projects/${project.slug}, with ${interested.length} ${interested.length === 1 ? "person" : "people"} on it.`,
    };
  });

  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${id}`);
  revalidatePath("/portal/proposals");
  revalidatePath("/portal/projects");
  return result;
}

/** A project address that is free, since the proposal's may already be taken. */
async function freeProjectSlug(base: string): Promise<string> {
  const db = getDb();
  const root = base || "project";
  const taken = await db.project.findMany({
    where: { slug: { startsWith: root } },
    select: { slug: true },
  });
  const used = new Set(taken.map((row) => row.slug));
  if (!used.has(root)) return root;
  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
