"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AdminActionError,
  invalidate,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import {
  memberRanks,
  roleLabels,
  scholarlyRecordSize,
  type MemberRankValue,
} from "@/lib/admin/members";
import { logUndeliveredLink } from "@/lib/auth";
import type { Viewer } from "@/lib/authz";
import { cacheTags } from "@/lib/cache-tags";
import { getDb } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/email";
import {
  createInvitationToken,
  INVITATION_LIFETIME_MS,
} from "@/lib/invitations";
import {
  canManageMember,
  parseSystemRole,
  type SystemRoleValue,
} from "@/lib/permissions";
import { confirmPassword, ReauthenticationError } from "@/lib/reauth";
import {
  notifyAccessChanged,
  notifyOwnersOfAdminGrant,
  notifyTwoFactorReset,
} from "@/lib/security-events";
import { siteOrigin } from "@/lib/site-url";

const invitableRoles = ["MEMBER", "REVIEWER", "ADMIN"] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseRank(value: string): MemberRankValue {
  if (!memberRanks.includes(value as MemberRankValue)) {
    throw new AdminActionError("Choose a rank.");
  }
  return value as MemberRankValue;
}

function parseInvitableRole(value: string): SystemRoleValue {
  if (!invitableRoles.includes(value as (typeof invitableRoles)[number])) {
    throw new AdminActionError("Choose a role.");
  }
  return value as SystemRoleValue;
}

async function deliverInvitation(input: {
  email: string;
  token: string;
  origin: string;
  inviter: Viewer;
  expiresAt: Date;
}): Promise<ActionState> {
  const url = `${input.origin}/portal/accept-invite/${input.token}`;
  try {
    const delivery = await sendInvitationEmail({
      to: input.email,
      url,
      inviterName: input.inviter.member?.name ?? input.inviter.name,
      expiresAt: input.expiresAt,
    });
    logUndeliveredLink("invitation", input.email, url, delivery.mode);
    return { status: "success", message: `Invitation sent to ${input.email}.` };
  } catch (error) {
    console.error("[admin] invitation email failed:", error);
    return {
      status: "error",
      message: `The invitation was saved, but the email to ${input.email} could not be sent. Check the email settings, then resend it.`,
    };
  }
}

/** Loads a member for an access change and applies the Owner protections. */
async function manageableMember(viewer: Viewer, memberId: string) {
  const member = await getDb().member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      rank: true,
      status: true,
      user: { select: { id: true, email: true, role: true } },
    },
  });
  if (!member) throw new AdminActionError("That member no longer exists.");

  const role = member.user ? parseSystemRole(member.user.role) : "MEMBER";
  if (member.user?.id === viewer.userId) {
    throw new AdminActionError(
      "You cannot change your own access. Ask another administrator.",
    );
  }
  if (!canManageMember(viewer.role, role)) {
    throw new AdminActionError("Only the Owner can change the Owner.");
  }
  return { member, role };
}

/** Irreversible actions need the administrator's password again. */
async function passwordConfirmed(viewer: Viewer, formData: FormData) {
  try {
    await confirmPassword(viewer, field(formData, "currentPassword"));
  } catch (error) {
    if (error instanceof ReauthenticationError) {
      throw new AdminActionError(error.message);
    }
    throw error;
  }
}

export async function inviteMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("members:manage", async (viewer) => {
    const email = field(formData, "email").toLowerCase();
    if (!emailPattern.test(email) || email.length > 254) {
      throw new AdminActionError("Enter a valid email address.");
    }
    const role = parseInvitableRole(field(formData, "role"));
    const rank = parseRank(field(formData, "rank"));
    if (!canManageMember(viewer.role, "MEMBER", role)) {
      throw new AdminActionError("You cannot grant that role.");
    }

    const db = getDb();
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new AdminActionError(
        "Someone with that email address already has an account.",
      );
    }

    // Resolve the link origin before saving, so a misconfiguration fails
    // cleanly instead of leaving an invitation nobody can receive.
    const origin = await siteOrigin();
    const { token, tokenHash } = createInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

    await db.$transaction(async (transaction) => {
      // A new invitation replaces any still-open one for the same address.
      await transaction.invitation.updateMany({
        where: { email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invitation = await transaction.invitation.create({
        data: {
          email,
          tokenHash,
          role,
          rank,
          invitedById: viewer.userId,
          expiresAt,
        },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "invitation.create",
        entity: "Invitation",
        entityId: invitation.id,
        diff: { email, role, rank },
      });
    });

    return deliverInvitation({
      email,
      token,
      origin,
      inviter: viewer,
      expiresAt,
    });
  });
  revalidatePath("/admin/members");
  return result;
}

async function resendInvitation(
  viewer: Viewer,
  invitationId: string,
): Promise<ActionState> {
  const db = getDb();
  const previous = await db.invitation.findFirst({
    where: {
      id: invitationId,
      acceptedAt: null,
      revokedAt: null,
    },
    select: { id: true, email: true, role: true, rank: true },
  });
  if (!previous) {
    throw new AdminActionError(
      "That invitation was already accepted or withdrawn.",
    );
  }
  if (!canManageMember(viewer.role, "MEMBER", previous.role)) {
    throw new AdminActionError("You cannot grant that role.");
  }

  const origin = await siteOrigin();
  const { token, tokenHash } = createInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

  await db.$transaction(async (transaction) => {
    const withdrawn = await transaction.invitation.updateMany({
      where: { id: previous.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (withdrawn.count !== 1) {
      throw new AdminActionError(
        "That invitation was already accepted or withdrawn.",
      );
    }
    const invitation = await transaction.invitation.create({
      data: {
        email: previous.email,
        tokenHash,
        role: previous.role,
        rank: previous.rank,
        invitedById: viewer.userId,
        expiresAt,
      },
    });
    await recordAudit(transaction, {
      actorId: viewer.userId,
      action: "invitation.resend",
      entity: "Invitation",
      entityId: invitation.id,
      diff: { email: previous.email, replaces: previous.id },
    });
  });

  return deliverInvitation({
    email: previous.email,
    token,
    origin,
    inviter: viewer,
    expiresAt,
  });
}

async function withdrawInvitation(
  viewer: Viewer,
  invitationId: string,
): Promise<ActionState> {
  await getDb().$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, acceptedAt: null, revokedAt: null },
      select: { id: true, email: true, role: true },
    });
    if (!invitation) {
      throw new AdminActionError(
        "That invitation was already accepted or withdrawn.",
      );
    }
    if (!canManageMember(viewer.role, "MEMBER", invitation.role)) {
      throw new AdminActionError("You cannot withdraw that invitation.");
    }
    await transaction.invitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });
    await recordAudit(transaction, {
      actorId: viewer.userId,
      action: "invitation.revoke",
      entity: "Invitation",
      entityId: invitation.id,
      diff: { email: invitation.email },
    });
  });
  return { status: "success", message: "Invitation withdrawn." };
}

/** One form serves every open invitation; the pressed button names the operation. */
export async function manageInvitationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("members:manage", async (viewer) => {
    const [operation, invitationId = ""] = field(formData, "operation").split(
      ":",
    );
    if (operation === "resend") return resendInvitation(viewer, invitationId);
    if (operation === "withdraw")
      return withdrawInvitation(viewer, invitationId);
    throw new AdminActionError("Choose resend or withdraw.");
  });
  revalidatePath("/admin/members");
  return result;
}

export async function updateMemberAccessAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const memberId = field(formData, "memberId");
  const result = await runAdminAction("members:manage", async (viewer) => {
    const { member, role } = await manageableMember(viewer, memberId);
    const nextRank = parseRank(field(formData, "rank"));
    const requestedRole = field(formData, "role");
    const nextRole = member.user ? parseInvitableRole(requestedRole) : role;

    if (role === "OWNER") {
      throw new AdminActionError(
        "The Owner's role changes only by transferring ownership.",
      );
    }
    if (!canManageMember(viewer.role, role, nextRole)) {
      throw new AdminActionError("You cannot grant that role.");
    }

    const diff: Record<string, { from: string; to: string }> = {};
    if (member.rank !== nextRank)
      diff.rank = { from: member.rank, to: nextRank };
    if (member.user && role !== nextRole)
      diff.role = { from: role, to: nextRole };
    if (Object.keys(diff).length === 0) {
      return { status: "success", message: "Nothing changed." };
    }

    await getDb().$transaction(async (transaction) => {
      if (diff.rank) {
        await transaction.member.update({
          where: { id: member.id },
          data: { rank: nextRank },
        });
      }
      if (diff.role && member.user) {
        await transaction.user.update({
          where: { id: member.user.id },
          data: { role: nextRole },
        });
      }
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "member.access",
        entity: "Member",
        entityId: member.id,
        diff,
      });
    });
    invalidate(cacheTags.members);

    if (diff.role && member.user) {
      notifyAccessChanged({
        to: member.user.email,
        name: member.name,
        from: roleLabels[role],
        toRole: roleLabels[nextRole],
        changedBy: viewer.name,
      });
      if (nextRole === "ADMIN") {
        await notifyOwnersOfAdminGrant({
          memberName: member.name,
          grantedBy: viewer.name,
          grantedById: viewer.userId,
        });
      }
    }
    return { status: "success", message: "Access updated." };
  });
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return result;
}

export async function setMemberStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const memberId = field(formData, "memberId");
  const result = await runAdminAction("members:manage", async (viewer) => {
    const { member, role } = await manageableMember(viewer, memberId);
    const status = field(formData, "status");
    if (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "ALUMNI") {
      throw new AdminActionError("Choose a status.");
    }
    if (role === "OWNER") {
      throw new AdminActionError(
        "The Owner cannot be suspended or made alumni.",
      );
    }
    if (member.status === status) {
      return { status: "success", message: "Nothing changed." };
    }

    await getDb().$transaction(async (transaction) => {
      await transaction.member.update({
        where: { id: member.id },
        data: {
          status,
          leftAt:
            status === "ALUMNI"
              ? new Date()
              : status === "ACTIVE"
                ? null
                : undefined,
        },
      });
      // Suspension takes effect immediately, not when the session expires.
      if (status === "SUSPENDED" && member.user) {
        await transaction.session.deleteMany({
          where: { userId: member.user.id },
        });
      }
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "member.status",
        entity: "Member",
        entityId: member.id,
        diff: { from: member.status, to: status },
      });
    });
    invalidate(cacheTags.members);
    return {
      status: "success",
      message:
        status === "SUSPENDED"
          ? `${member.name} is suspended and has been signed out.`
          : status === "ALUMNI"
            ? `${member.name} is now listed as alumni.`
            : `${member.name} is active again.`,
    };
  });
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return result;
}

export async function removeMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("members:manage", async (viewer) => {
    const { member, role } = await manageableMember(
      viewer,
      field(formData, "memberId"),
    );
    if (role === "OWNER") {
      throw new AdminActionError("The Owner cannot be removed.");
    }
    if (field(formData, "confirmation") !== member.name) {
      throw new AdminActionError(`Type ${member.name} exactly to confirm.`);
    }
    await passwordConfirmed(viewer, formData);

    await getDb().$transaction(async (transaction) => {
      const record = await transaction.member.findUniqueOrThrow({
        where: { id: member.id },
        select: {
          _count: {
            select: {
              authorships: true,
              projects: true,
              insights: true,
              experiments: true,
            },
          },
        },
      });
      if (scholarlyRecordSize(record._count) > 0) {
        throw new AdminActionError(
          `${member.name} is credited on lab work. Mark them as alumni to keep that record intact.`,
        );
      }
      if (member.user) {
        const invited = await transaction.invitation.count({
          where: { invitedById: member.user.id },
        });
        if (invited > 0) {
          throw new AdminActionError(
            `${member.name} has invited other people, which the record keeps. Suspend them or mark them as alumni instead.`,
          );
        }
      }

      await transaction.member.delete({ where: { id: member.id } });
      if (member.user) {
        await transaction.user.delete({ where: { id: member.user.id } });
      }
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "member.remove",
        entity: "Member",
        entityId: member.id,
        diff: { name: member.name, email: member.user?.email ?? null },
      });
    });
    invalidate(cacheTags.members);
    return { status: "success", message: `${member.name} was removed.` };
  });

  if (result.status === "success") redirect("/admin/members");
  return result;
}

/** For a member who lost both their phone and their backup codes. */
export async function resetMemberTwoFactorAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const memberId = field(formData, "memberId");
  const result = await runAdminAction("members:manage", async (viewer) => {
    const { member } = await manageableMember(viewer, memberId);
    if (!member.user) {
      throw new AdminActionError(`${member.name} has no account.`);
    }
    if (field(formData, "confirmation") !== member.name) {
      throw new AdminActionError(`Type ${member.name} exactly to confirm.`);
    }
    await passwordConfirmed(viewer, formData);

    const userId = member.user.id;
    await getDb().$transaction(async (transaction) => {
      await transaction.twoFactor.deleteMany({ where: { userId } });
      await transaction.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false },
      });
      await transaction.session.deleteMany({ where: { userId } });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "member.two_factor_reset",
        entity: "Member",
        entityId: member.id,
      });
    });
    notifyTwoFactorReset({
      to: member.user.email,
      name: member.name,
      resetBy: viewer.name,
    });
    return {
      status: "success",
      message: `Two-factor authentication was reset for ${member.name}.`,
    };
  });
  revalidatePath(`/admin/members/${memberId}`);
  return result;
}

export async function transferOwnershipAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const memberId = field(formData, "memberId");
  const result = await runAdminAction("ownership:transfer", async (viewer) => {
    const member = await getDb().member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        name: true,
        status: true,
        user: { select: { id: true } },
      },
    });
    if (!member?.user || member.status !== "ACTIVE") {
      throw new AdminActionError(
        "Ownership can pass only to an active member with an account.",
      );
    }
    if (member.user.id === viewer.userId) {
      throw new AdminActionError("You already own the lab.");
    }
    if (field(formData, "confirmation") !== member.name) {
      throw new AdminActionError(`Type ${member.name} exactly to confirm.`);
    }
    await passwordConfirmed(viewer, formData);
    const newOwnerId = member.user.id;

    await getDb().$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: newOwnerId },
        data: { role: "OWNER" },
      });
      await transaction.user.update({
        where: { id: viewer.userId },
        data: { role: "ADMIN" },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "ownership.transfer",
        entity: "User",
        entityId: newOwnerId,
        diff: { from: viewer.userId, to: newOwnerId },
      });
    });
    return { status: "success", message: `${member.name} now owns the lab.` };
  });

  if (result.status === "success") redirect(`/admin/members/${memberId}`);
  return result;
}
