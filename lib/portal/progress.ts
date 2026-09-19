import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { memberProjectIds, workspaceMemberId } from "@/lib/portal-content";

/**
 * Progress on a project: the stage it is at, and what the team has written
 * about it. Members read and write this for their own projects only; the
 * public sees the stage and whichever updates were deliberately published
 * (`publicProjectUpdateWhere`).
 */

export const UPDATES_PAGE_SIZE = 50;

export interface ProgressAttachment {
  id: string;
  kind: string;
  title: string;
  contentType: string;
  byteSize: number;
}

export interface ProgressUpdate {
  id: string;
  title: string;
  body: string;
  nextUp: string | null;
  isPublic: boolean;
  stage: string;
  author: { slug: string; name: string } | null;
  createdAt: Date;
  attachments: ProgressAttachment[];
  /** Whether this viewer wrote it, and so may change or withdraw it. */
  mine: boolean;
}

export interface ProjectProgress {
  id: string;
  slug: string;
  title: string;
  gloss: string;
  status: string;
  /** The project's own publish state: whether the outside can see it at all. */
  state: string;
  role: string;
  isLead: boolean;
  updates: ProgressUpdate[];
}

/**
 * The viewer's place on a project, by slug — one indexed row, cheap enough to
 * ask on a public page so the people who work on a project get their own
 * controls there without signing in again or going looking for them.
 * `null` for a visitor, for a signed-out reader, and for a member who is not
 * on this project: in every one of those cases no control is drawn.
 */
export async function membershipOf(
  viewer: Viewer | null,
  slug: string,
): Promise<{ isLead: boolean; role: string } | null> {
  const memberId = viewer ? workspaceMemberId(viewer) : null;
  if (!memberId || !isDatabaseConfigured()) return null;

  const membership = await getDb().projectMember.findFirst({
    where: { memberId, project: { slug } },
    select: { isLead: true, role: true },
  });
  return membership;
}

/** Whether the viewer is on this project; nothing here works without that. */
export async function onProject(
  viewer: Viewer,
  projectId: string,
): Promise<boolean> {
  return (await memberProjectIds(viewer)).includes(projectId);
}

export async function getProjectProgress(
  viewer: Viewer,
  slug: string,
): Promise<ProjectProgress | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const row = await getDb().project.findFirst({
    // Keyed on the viewer's membership, so a slug alone reaches nothing.
    where: { slug, members: { some: { memberId } } },
    select: {
      id: true,
      slug: true,
      title: true,
      gloss: true,
      status: true,
      state: true,
      members: {
        where: { memberId },
        select: { role: true, isLead: true },
      },
      updates: {
        orderBy: { createdAt: "desc" },
        take: UPDATES_PAGE_SIZE,
        select: {
          id: true,
          title: true,
          body: true,
          nextUp: true,
          isPublic: true,
          stage: true,
          createdAt: true,
          authorId: true,
          author: { select: { slug: true, name: true } },
          attachments: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              kind: true,
              title: true,
              contentType: true,
              byteSize: true,
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  const membership = row.members[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    gloss: row.gloss,
    status: row.status,
    state: row.state,
    role: membership?.role ?? "Member",
    isLead: membership?.isLead ?? false,
    updates: row.updates.map(({ authorId, ...update }) => ({
      ...update,
      mine: authorId === memberId,
    })),
  };
}

/** Who may change an update: the person who wrote it, or a project lead. */
export async function canEditUpdate(
  viewer: Viewer,
  updateId: string,
): Promise<{ allowed: boolean; projectId: string | null }> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) {
    return { allowed: false, projectId: null };
  }

  const update = await getDb().projectUpdate.findUnique({
    where: { id: updateId },
    select: {
      authorId: true,
      projectId: true,
      project: {
        select: { members: { where: { memberId }, select: { isLead: true } } },
      },
    },
  });
  if (!update) return { allowed: false, projectId: null };

  const membership = update.project.members[0];
  return {
    allowed:
      Boolean(membership) &&
      (update.authorId === memberId || membership!.isLead),
    projectId: update.projectId,
  };
}
