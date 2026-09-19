import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import type { Viewer } from "@/lib/authz";
import { createPrivateDownloadUrl } from "@/lib/storage";

/**
 * What a signed-in member may read about their own work. Every query is keyed
 * on the viewer's member id rather than on an id from the request: the member
 * portal and the mobile app both read through here, so there is one place
 * where per-record ownership is decided.
 *
 * Nothing here is public. Callers must already have `portal:access`.
 */

/** A viewer with no member record has no workspace, only an account. */
export function workspaceMemberId(viewer: Viewer): string | null {
  return viewer.member && viewer.member.status !== "SUSPENDED"
    ? viewer.member.id
    : null;
}

export interface MemberProfile {
  id: string;
  slug: string;
  name: string;
  rank: string;
  status: string;
  title: string | null;
  bio: string | null;
  interests: string[];
  orgEmail: string | null;
  showOrgEmail: boolean;
  scholarUrl: string | null;
  orcid: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  /** Whether the profile appears on the public people pages. */
  isPublic: boolean;
  joinedAt: Date | null;
  areas: Array<{ slug: string; name: string; role: string; isLead: boolean }>;
}

export async function getMemberProfile(
  viewer: Viewer,
): Promise<MemberProfile | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const member = await getDb().member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      slug: true,
      name: true,
      rank: true,
      status: true,
      title: true,
      bio: true,
      interests: true,
      orgEmail: true,
      showOrgEmail: true,
      scholarUrl: true,
      orcid: true,
      githubUrl: true,
      linkedinUrl: true,
      websiteUrl: true,
      isPublic: true,
      joinedAt: true,
      areas: {
        select: {
          role: true,
          isLead: true,
          area: { select: { slug: true, name: true } },
        },
      },
    },
  });
  if (!member) return null;

  const { areas, ...profile } = member;
  return {
    ...profile,
    areas: areas.map(({ area, role, isLead }) => ({ ...area, role, isLead })),
  };
}

export interface MemberProject {
  id: string;
  slug: string;
  title: string;
  gloss: string;
  status: string;
  /** The project's publish state: a member sees their drafts, the public does not. */
  state: string;
  role: string;
  isLead: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
}

/** Projects the viewer is on, at whatever publish state they are in. */
export async function getMemberProjects(
  viewer: Viewer,
): Promise<MemberProject[]> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return [];

  const rows = await getDb().projectMember.findMany({
    where: { memberId },
    orderBy: [{ sortOrder: "asc" }, { project: { title: "asc" } }],
    select: {
      role: true,
      isLead: true,
      project: {
        select: {
          id: true,
          slug: true,
          title: true,
          gloss: true,
          status: true,
          state: true,
          startedAt: true,
          endedAt: true,
        },
      },
    },
  });

  return rows.map(({ project, role, isLead }) => ({
    ...project,
    role,
    isLead,
  }));
}

/** The ids of the projects the viewer belongs to, for ownership checks. */
export async function memberProjectIds(viewer: Viewer): Promise<string[]> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return [];
  const rows = await getDb().projectMember.findMany({
    where: { memberId },
    select: { projectId: true },
  });
  return rows.map((row) => row.projectId);
}

export interface MemberAnnouncement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author: { slug: string; name: string } | null;
  createdAt: Date;
  /** Whether this viewer has already marked it read. */
  read: boolean;
}

export const ANNOUNCEMENTS_PAGE_SIZE = 50;

/** Lab-wide announcements, pinned first. Everyone with a member record sees all. */
export async function getMemberAnnouncements(
  viewer: Viewer,
  limit = ANNOUNCEMENTS_PAGE_SIZE,
): Promise<MemberAnnouncement[]> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return [];

  const rows = await getDb().announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(1, limit), ANNOUNCEMENTS_PAGE_SIZE),
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      readBy: true,
      author: { select: { slug: true, name: true } },
    },
  });

  return rows.map(({ readBy, ...row }) => ({
    ...row,
    read: readBy.includes(memberId),
  }));
}

export interface MemberDocument {
  id: string;
  title: string;
  project: { slug: string; title: string };
  uploadedBy: { slug: string; name: string } | null;
  createdAt: Date;
  /** An external address, or a short-lived link to the private file. */
  url: string | null;
  /** True when `url` is a signed link that expires. */
  expiring: boolean;
}

export const DOCUMENTS_PAGE_SIZE = 100;

/**
 * Documents attached to the viewer's own projects. A project the viewer is not
 * on is not listed and its files are never signed, whatever their role: this
 * is ownership, not a capability.
 */
export async function getMemberDocuments(
  viewer: Viewer,
  options: { projectSlug?: string; limit?: number } = {},
): Promise<MemberDocument[]> {
  const projectIds = await memberProjectIds(viewer);
  if (projectIds.length === 0) return [];

  const rows = await getDb().document.findMany({
    where: {
      projectId: { in: projectIds },
      ...(options.projectSlug
        ? { project: { slug: options.projectSlug } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(
      Math.max(1, options.limit ?? DOCUMENTS_PAGE_SIZE),
      DOCUMENTS_PAGE_SIZE,
    ),
    select: {
      id: true,
      title: true,
      fileKey: true,
      url: true,
      createdAt: true,
      project: { select: { slug: true, title: true } },
      uploadedBy: { select: { slug: true, name: true } },
    },
  });

  return rows.map(({ fileKey, url, ...row }) => {
    if (fileKey) {
      try {
        return {
          ...row,
          url: createPrivateDownloadUrl(fileKey),
          expiring: true,
        };
      } catch (error) {
        // Storage not configured: the record still lists, without a link.
        console.error("[portal] could not sign a document link:", error);
        return { ...row, url: null, expiring: false };
      }
    }
    return { ...row, url: url ?? null, expiring: false };
  });
}
