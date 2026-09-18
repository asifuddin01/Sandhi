import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

export const memberRanks = [
  "DIRECTOR",
  "RESEARCH_LEAD",
  "RESEARCHER",
  "RESEARCH_ASSISTANT",
  "INTERN",
  "COLLABORATOR",
] as const;

export const memberStatuses = [
  "INVITED",
  "ACTIVE",
  "ALUMNI",
  "SUSPENDED",
] as const;

export type MemberRankValue = (typeof memberRanks)[number];
export type MemberStatusValue = (typeof memberStatuses)[number];

export const rankLabels: Record<MemberRankValue, string> = {
  DIRECTOR: "Director",
  RESEARCH_LEAD: "Research lead",
  RESEARCHER: "Researcher",
  RESEARCH_ASSISTANT: "Research assistant",
  INTERN: "Intern",
  COLLABORATOR: "Collaborator",
};

export const statusLabels: Record<MemberStatusValue, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  ALUMNI: "Alumni",
  SUSPENDED: "Suspended",
};

export const roleLabels = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  REVIEWER: "Reviewer",
  MEMBER: "Member",
} as const;

export async function getMembersIndex(filters: {
  query?: string;
  status?: MemberStatusValue;
}) {
  const query = filters.query?.trim().slice(0, 120);
  const where: Prisma.MemberWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { user: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const db = getDb();
  const [members, invitations] = await Promise.all([
    db.member.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: 500,
      select: {
        id: true,
        name: true,
        rank: true,
        status: true,
        isPublic: true,
        user: { select: { email: true, role: true } },
      },
    }),
    db.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        rank: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
    }),
  ]);

  return { members, invitations };
}

export async function getMemberDetail(id: string) {
  const db = getDb();
  const member = await db.member.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      rank: true,
      status: true,
      isPublic: true,
      joinedAt: true,
      leftAt: true,
      user: {
        select: { id: true, email: true, role: true, twoFactorEnabled: true },
      },
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
  if (!member) return null;

  const history = await db.auditLog.findMany({
    where: {
      OR: [
        { entity: "Member", entityId: member.id },
        ...(member.user ? [{ entity: "User", entityId: member.user.id }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  return { member, history };
}

/** Members credited anywhere keep their record; they become alumni instead. */
export function scholarlyRecordSize(counts: {
  authorships: number;
  projects: number;
  insights: number;
  experiments: number;
}): number {
  return (
    counts.authorships + counts.projects + counts.insights + counts.experiments
  );
}
