"use server";

import { revalidatePath } from "next/cache";

import {
  AdminActionError,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import {
  APPLICATION_STATUS_LABELS,
  canInvite,
  isApplicationStatus,
  isRating,
  MAX_APPLICATION_NOTE,
  type ApplicationStatusValue,
} from "@/lib/applications";
import { logUndeliveredLink } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/email";
import {
  createInvitationToken,
  INVITATION_LIFETIME_MS,
} from "@/lib/invitations";
import { memberRanks, type MemberRankValue } from "@/lib/member-rank";
import { siteOrigin } from "@/lib/site-url";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function application(id: string) {
  const record = await getDb().application.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, status: true, rating: true },
  });
  if (!record) throw new AdminActionError("That application no longer exists.");
  return record;
}

function refresh(id: string): void {
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
  // The dashboard counts the ones still waiting.
  revalidatePath("/admin");
}

export async function setApplicationStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const result = await runAdminAction("applications:manage", async (viewer) => {
    const record = await application(id);
    const next = field(formData, "status");
    if (!isApplicationStatus(next)) {
      throw new AdminActionError("Choose one of the listed states.");
    }
    // Invited is not a state anybody sets by hand: it means an invitation
    // was actually created and sent, which only the invite action does.
    if (next === "INVITED") {
      throw new AdminActionError(
        "Send the invitation instead; that sets this itself.",
      );
    }
    if (record.status === next) {
      return { status: "success", message: "Nothing changed." };
    }

    await getDb().$transaction(async (transaction) => {
      await transaction.application.update({
        where: { id: record.id },
        data: { status: next },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "application.status",
        entity: "Application",
        entityId: record.id,
        diff: { status: { from: record.status, to: next } },
      });
    });

    return {
      status: "success",
      message: `Moved to ${APPLICATION_STATUS_LABELS[next]}.`,
    };
  });
  refresh(id);
  return result;
}

export async function rateApplicationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const result = await runAdminAction("applications:manage", async (viewer) => {
    const record = await application(id);
    const raw = field(formData, "rating");
    const rating = raw === "" ? null : Number(raw);
    if (rating !== null && !isRating(rating)) {
      throw new AdminActionError("A rating is a whole number from 1 to 5.");
    }
    if (record.rating === rating) {
      return { status: "success", message: "Nothing changed." };
    }

    await getDb().$transaction(async (transaction) => {
      await transaction.application.update({
        where: { id: record.id },
        data: { rating },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "application.rating",
        entity: "Application",
        entityId: record.id,
        diff: { rating: { from: record.rating, to: rating } },
      });
    });

    return {
      status: "success",
      message: rating === null ? "Rating cleared." : `Rated ${rating}.`,
    };
  });
  refresh(id);
  return result;
}

export async function addApplicationNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const result = await runAdminAction("applications:manage", async (viewer) => {
    const record = await application(id);
    const body = field(formData, "body").trim();
    if (body.length < 2) throw new AdminActionError("Write the note first.");
    if (body.length > MAX_APPLICATION_NOTE) {
      throw new AdminActionError(
        `Keep a note within ${MAX_APPLICATION_NOTE} characters.`,
      );
    }

    await getDb().$transaction(async (transaction) => {
      const note = await transaction.applicationNote.create({
        data: {
          applicationId: record.id,
          // An account with no member record still leaves a note; the audit
          // entry carries who it was either way.
          authorId: viewer.member?.id ?? null,
          body,
        },
        select: { id: true },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "application.note",
        entity: "Application",
        entityId: record.id,
        // The note's text stays in the note. An audit entry is read by more
        // people and kept longer than the thing it describes.
        diff: { noteId: note.id, length: body.length },
      });
    });

    return { status: "success", message: "Note added." };
  });
  refresh(id);
  return result;
}

function parseRank(value: string): MemberRankValue {
  return (memberRanks as readonly string[]).includes(value)
    ? (value as MemberRankValue)
    : "RESEARCHER";
}

/**
 * Turns an accepted application into an invitation: the same invitation the
 * members manager sends, so the person lands in the same onboarding — accept,
 * set up an authenticator, write a profile.
 */
export async function inviteApplicantAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const result = await runAdminAction("applications:manage", async (viewer) => {
    const record = await application(id);
    if (!canInvite(record.status)) {
      throw new AdminActionError(
        "Accept the application first, then invite them.",
      );
    }
    const rank = parseRank(field(formData, "rank"));

    const db = getDb();
    const existing = await db.user.findUnique({
      where: { email: record.email },
      select: { id: true },
    });
    if (existing) {
      throw new AdminActionError(
        "Someone with that email address already has an account.",
      );
    }

    // Resolved before anything is saved, so a misconfiguration fails cleanly
    // rather than leaving an invitation nobody can receive.
    const origin = await siteOrigin();
    const { token, tokenHash } = createInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

    await db.$transaction(async (transaction) => {
      await transaction.invitation.updateMany({
        where: { email: record.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invitation = await transaction.invitation.create({
        data: {
          email: record.email,
          tokenHash,
          // An applicant is invited as an ordinary member. Administration is
          // granted afterwards, deliberately, in the members manager.
          role: "MEMBER",
          rank,
          invitedById: viewer.userId,
          expiresAt,
        },
        select: { id: true },
      });
      await transaction.application.update({
        where: { id: record.id },
        data: { status: "INVITED" satisfies ApplicationStatusValue },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "application.invited",
        entity: "Application",
        entityId: record.id,
        diff: { invitationId: invitation.id, rank },
      });
    });

    const url = `${origin}/portal/accept-invite/${token}`;
    try {
      const delivery = await sendInvitationEmail({
        to: record.email,
        url,
        inviterName: viewer.member?.name ?? viewer.name,
        expiresAt,
      });
      logUndeliveredLink("invitation", record.email, url, delivery.mode);
    } catch (error) {
      console.error("[admin] applicant invitation email failed:", error);
      return {
        status: "success",
        message: `${record.name} is invited, but the email could not be sent. Resend it from Members.`,
      };
    }

    return {
      status: "success",
      message: `Invitation sent to ${record.email}.`,
    };
  });
  refresh(id);
  revalidatePath("/admin/members");
  return result;
}
