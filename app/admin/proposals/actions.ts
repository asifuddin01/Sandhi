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
import { sendProposalDecisionEmail } from "@/lib/email";
import {
  canApprove,
  canMove,
  MAX_DECISION_NOTE,
  MAX_PROPOSER_MESSAGE,
  REVIEW_TRANSITIONS,
  tellsProposer,
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
 * What the proposer is told, which is not the decision note. The note is
 * written for whoever picks the proposal up next and the schema says it is
 * never shown publicly; this is written for the person who sent the idea in.
 */
function proposerMessage(formData: FormData): string | null {
  const value = field(formData, "proposerMessage").trim();
  if (value.length > MAX_PROPOSER_MESSAGE) {
    throw new AdminActionError("That message to the proposer is too long.");
  }
  return value || null;
}

/**
 * Tells whoever sent the idea, and records that they were told. The decision
 * is already saved: a failed email must not undo it, so the failure is
 * reported and the proposal keeps showing that nobody was told.
 */
async function tellProposer(
  proposal: {
    id: string;
    title: string;
    proposerName: string;
    proposerEmail: string;
  },
  approved: boolean,
  message: string | null,
  actorId: string,
): Promise<boolean> {
  try {
    await sendProposalDecisionEmail({
      to: proposal.proposerEmail,
      name: proposal.proposerName,
      title: proposal.title,
      approved,
      message,
      // An approved proposal becomes a DRAFT project, so there is nothing
      // for the proposer to open yet. A link to a page they cannot see
      // would be worse than no link.
      url: null,
    });
  } catch (error) {
    console.error("[admin] proposal decision email failed:", error);
    return false;
  }

  await getDb().$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: { decisionSentAt: new Date() },
    });
    await recordAudit(tx, {
      actorId,
      action: "proposal.told",
      entity: "Proposal",
      entityId: proposal.id,
      diff: { approved, withMessage: message !== null },
    });
  });
  return true;
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
      select: {
        status: true,
        title: true,
        proposerName: true,
        proposerEmail: true,
      },
    });
    if (!proposal) throw new AdminActionError("That proposal is gone.");
    if (!canMove(proposal.status, move)) {
      throw new AdminActionError(
        `A proposal that is ${proposal.status.toLowerCase().replace("_", " ")} cannot be ${move}d.`,
      );
    }

    const reviewerId = workspaceMemberId(viewer);
    const next = REVIEW_TRANSITIONS[move].to;

    const message = proposerMessage(formData);

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: {
          status: next,
          reviewerId,
          decisionNote: note(formData),
          // A new decision has not been told yet, whatever was told before.
          decisionSentAt: null,
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

    if (!tellsProposer(next)) {
      return {
        status: "success",
        message:
          move === "queue"
            ? "Queued. The lab can see it and say who is in."
            : "Taken. It is yours to read.",
      };
    }

    const told = await tellProposer(
      { id, ...proposal },
      false,
      message,
      viewer.userId,
    );
    return {
      status: told ? "success" : "error",
      message: told
        ? `Sent back, and ${proposal.proposerName} has been told.`
        : `Sent back, but the email to ${proposal.proposerEmail} did not go. Send it again below.`,
    };
  });

  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${id}`);
  revalidatePath("/portal/proposals");
  return result;
}

/**
 * Sends a decision that was made but never reached the proposer, because the
 * email failed at the time. Without it, a reviewer can see that nobody was
 * told and have no way to put it right.
 */
export async function tellProposerAgainAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const result = await runAdminAction("proposals:review", async (viewer) => {
    const proposal = await getDb().proposal.findUnique({
      where: { id },
      select: {
        status: true,
        title: true,
        proposerName: true,
        proposerEmail: true,
        decisionSentAt: true,
      },
    });
    if (!proposal) throw new AdminActionError("That proposal is gone.");
    if (!tellsProposer(proposal.status)) {
      throw new AdminActionError("There is no decision to tell them about.");
    }
    if (proposal.decisionSentAt) {
      return { status: "success", message: "They have already been told." };
    }

    const told = await tellProposer(
      { id, ...proposal },
      proposal.status === "APPROVED",
      proposerMessage(formData),
      viewer.userId,
    );
    if (!told) {
      throw new AdminActionError(
        `The email to ${proposal.proposerEmail} did not go. Check the email settings.`,
      );
    }
    return {
      status: "success",
      message: `${proposal.proposerName} has been told.`,
    };
  });
  revalidatePath(`/admin/proposals/${id}`);
  revalidatePath("/admin/proposals");
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
        proposerName: true,
        proposerEmail: true,
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
          decisionSentAt: null,
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

    const became = `Approved. It is now the project /projects/${project.slug}, with ${interested.length} ${interested.length === 1 ? "person" : "people"} on it.`;
    const told = await tellProposer(
      { id, ...proposal },
      true,
      proposerMessage(formData),
      viewer.userId,
    );
    return {
      status: told ? "success" : "error",
      message: told
        ? `${became} ${proposal.proposerName} has been told.`
        : `${became} The email to ${proposal.proposerEmail} did not go — send it again below.`,
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
