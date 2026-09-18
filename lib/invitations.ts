import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const tokenPattern = /^[A-Za-z0-9_-]{40,64}$/u;

export class InvitationError extends Error {
  constructor(readonly code: "INVALID" | "ACCOUNT_EXISTS") {
    super(
      code === "ACCOUNT_EXISTS"
        ? "An account already exists for this email address."
        : "This invitation is no longer valid.",
    );
  }
}

/** Only the hash is stored; the token itself exists only in the email link. */
export function createInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function openInvitationWhere(tokenHash: string, now: Date) {
  return {
    tokenHash,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { gt: now },
  } satisfies Prisma.InvitationWhereInput;
}

export async function findOpenInvitation(token: string, now = new Date()) {
  if (!tokenPattern.test(token)) return null;
  return getDb().invitation.findFirst({
    where: openInvitationWhere(hashInvitationToken(token), now),
    select: {
      id: true,
      email: true,
      role: true,
      rank: true,
      member: { select: { name: true } },
    },
  });
}

export function slugifyName(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 80) || "member"
  );
}

async function uniqueMemberSlug(
  transaction: Prisma.TransactionClient,
  name: string,
): Promise<string> {
  const base = slugifyName(name);
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const taken = await transaction.member.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) return slug;
  }
  throw new Error("Could not allocate a member slug.");
}

/**
 * Creates the account, credential, and member for an invitation in one
 * transaction. The invitation is claimed with a conditional update, so the
 * same link cannot create two accounts.
 */
export async function acceptInvitation(
  input: { token: string; name: string; password: string },
  now = new Date(),
): Promise<{ email: string }> {
  if (!tokenPattern.test(input.token)) throw new InvitationError("INVALID");
  const tokenHash = hashInvitationToken(input.token);
  const passwordHash = await hashPassword(input.password);

  return getDb().$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: openInvitationWhere(tokenHash, now),
      select: {
        id: true,
        email: true,
        role: true,
        rank: true,
        memberId: true,
        member: { select: { userId: true } },
      },
    });
    if (!invitation || invitation.member?.userId) {
      throw new InvitationError("INVALID");
    }

    const email = invitation.email.trim().toLowerCase();
    const existing = await transaction.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) throw new InvitationError("ACCOUNT_EXISTS");

    const user = await transaction.user.create({
      // The invitation link proves the address, so it is verified here.
      data: {
        name: input.name,
        email,
        emailVerified: true,
        role: invitation.role,
      },
    });
    await transaction.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });

    const member = invitation.memberId
      ? await transaction.member.update({
          where: { id: invitation.memberId },
          data: { userId: user.id, status: "ACTIVE", joinedAt: now },
        })
      : await transaction.member.create({
          data: {
            userId: user.id,
            slug: await uniqueMemberSlug(transaction, input.name),
            name: input.name,
            rank: invitation.rank,
            status: "ACTIVE",
            isPublic: false,
            joinedAt: now,
          },
        });

    const claimed = await transaction.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: now, acceptedById: user.id, memberId: member.id },
    });
    if (claimed.count !== 1) throw new InvitationError("INVALID");

    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        action: "invitation.accept",
        entity: "Invitation",
        entityId: invitation.id,
        diff: { role: invitation.role, rank: invitation.rank },
      },
    });

    return { email };
  });
}
