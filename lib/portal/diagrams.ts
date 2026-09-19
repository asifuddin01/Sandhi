import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { MAX_SOURCE_LENGTH } from "@/lib/diagrams/mermaid-source";
import { memberProjectIds, workspaceMemberId } from "@/lib/portal-content";

/**
 * A member's own diagrams. Every query is keyed on the viewer's member id, as
 * the rest of the workspace is (`lib/portal-content.ts`), so a diagram is
 * reachable only by the person who made it — or, when it is attached to a
 * project, by that project's team.
 */

export const DIAGRAMS_PAGE_SIZE = 100;
export const MAX_DIAGRAM_TITLE = 160;
export { MAX_SOURCE_LENGTH };

export interface DiagramSummary {
  id: string;
  title: string;
  updatedAt: Date;
  project: { slug: string; title: string } | null;
  /** Whose it is, for a diagram shared through a project. */
  owner: { slug: string; name: string };
  mine: boolean;
}

export interface DiagramRecord extends DiagramSummary {
  source: string;
  /** Positions and colours, checked again on read (`lib/diagrams/persist.ts`). */
  layout: unknown;
  projectId: string | null;
}

/**
 * Everything the viewer may open: their own diagrams, plus any attached to a
 * project they are on. Written as one `OR` so a diagram can never be reached
 * by an id alone.
 */
async function readableWhere(viewer: Viewer) {
  const memberId = workspaceMemberId(viewer);
  if (!memberId) return null;
  const projectIds = await memberProjectIds(viewer);
  return {
    OR: [
      { ownerId: memberId },
      ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
    ],
  };
}

function toSummary(
  row: {
    id: string;
    title: string;
    updatedAt: Date;
    ownerId: string;
    project: { slug: string; title: string } | null;
    owner: { slug: string; name: string };
  },
  memberId: string,
): DiagramSummary {
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt,
    project: row.project,
    owner: row.owner,
    mine: row.ownerId === memberId,
  };
}

export async function listDiagrams(viewer: Viewer): Promise<DiagramSummary[]> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return [];
  const where = await readableWhere(viewer);
  if (!where) return [];

  const rows = await getDb().diagram.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: DIAGRAMS_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      ownerId: true,
      project: { select: { slug: true, title: true } },
      owner: { select: { slug: true, name: true } },
    },
  });
  return rows.map((row) => toSummary(row, memberId));
}

/** One diagram, or null when the viewer may not open it. */
export async function getDiagram(
  viewer: Viewer,
  id: string,
): Promise<DiagramRecord | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;
  const where = await readableWhere(viewer);
  if (!where) return null;

  const row = await getDb().diagram.findFirst({
    // The id narrows what the viewer may already read; it never widens it.
    where: { AND: [{ id }, where] },
    select: {
      id: true,
      title: true,
      source: true,
      layout: true,
      projectId: true,
      updatedAt: true,
      ownerId: true,
      project: { select: { slug: true, title: true } },
      owner: { select: { slug: true, name: true } },
    },
  });
  if (!row) return null;
  return {
    ...toSummary(row, memberId),
    source: row.source,
    layout: row.layout,
    projectId: row.projectId,
  };
}

/** Only the owner may change or delete a diagram, not the whole project team. */
export async function ownsDiagram(
  viewer: Viewer,
  id: string,
): Promise<boolean> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return false;
  return (
    (await getDb().diagram.count({ where: { id, ownerId: memberId } })) === 1
  );
}

/** Projects the viewer may attach a diagram to: their own, and no others. */
export async function attachableProjects(
  viewer: Viewer,
): Promise<Array<{ id: string; title: string }>> {
  const projectIds = await memberProjectIds(viewer);
  if (projectIds.length === 0) return [];
  return getDb().project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
}
