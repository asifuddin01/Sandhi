import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { can } from "@/lib/permissions";
import { workspaceMemberId } from "@/lib/portal-content";

/**
 * The research workspace: what was tried, with what settings, what came of
 * it, and a running log alongside.
 *
 * An experiment belongs to a project, and everyone on that project sees it —
 * a record only one person can read is a notebook, not a workspace. Changing
 * one is narrower: whoever is running it, or whoever leads the project.
 */

export { MAX_LOG_ENTRY } from "@/lib/portal/experiment-limits";

export const EXPERIMENTS_LIMIT = 200;
export const LOG_PAGE_SIZE = 100;

export interface ExperimentLogEntry {
  id: string;
  body: string;
  createdAt: Date;
}

export interface MemberExperiment {
  id: string;
  name: string;
  hypothesis: string | null;
  /** Parsed JSON, or null. Rendered as text; never executed. */
  config: unknown;
  results: unknown;
  datasetRefs: string[];
  modelInfo: string | null;
  notes: string | null;
  milestone: string | null;
  trackingUrl: string | null;
  project: { id: string; slug: string; title: string };
  owner: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
  /** The viewer may change it or add to its log. */
  editable: boolean;
}

/**
 * Who may change an experiment: the person running it, or whoever leads the
 * project it belongs to. An administrator organises across the lab, so they
 * may too.
 */
export function mayEditExperiment(
  viewer: Viewer,
  ownerId: string,
  projectId: string,
  ledProjectIds: readonly string[],
): boolean {
  if (can(viewer.role, "projects:manage")) return true;
  if (workspaceMemberId(viewer) === ownerId) return true;
  return ledProjectIds.includes(projectId);
}

/** The projects a member is on, and which of those they lead. */
async function reach(memberId: string) {
  const memberships = await getDb().projectMember.findMany({
    where: { memberId },
    select: {
      projectId: true,
      isLead: true,
      isAssistantLead: true,
      project: { select: { title: true } },
    },
    orderBy: { project: { title: "asc" } },
  });
  return {
    projectIds: memberships.map((row) => row.projectId),
    ledProjectIds: memberships
      .filter((row) => row.isLead || row.isAssistantLead)
      .map((row) => row.projectId),
    projects: memberships.map((row) => ({
      id: row.projectId,
      title: row.project.title,
    })),
  };
}

const SELECT = {
  id: true,
  name: true,
  hypothesis: true,
  config: true,
  results: true,
  datasetRefs: true,
  modelInfo: true,
  notes: true,
  milestone: true,
  trackingUrl: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, slug: true, title: true } },
  owner: { select: { id: true, name: true } },
} as const;

type Row = {
  ownerId: string;
  project: { id: string; slug: string; title: string };
} & Omit<MemberExperiment, "editable" | "project" | "config" | "results"> & {
    config: unknown;
    results: unknown;
  };

function shape(
  row: Row,
  viewer: Viewer,
  ledProjectIds: readonly string[],
): MemberExperiment {
  return {
    id: row.id,
    name: row.name,
    hypothesis: row.hypothesis,
    config: row.config ?? null,
    results: row.results ?? null,
    datasetRefs: row.datasetRefs,
    modelInfo: row.modelInfo,
    notes: row.notes,
    milestone: row.milestone,
    trackingUrl: row.trackingUrl,
    project: row.project,
    owner: row.owner,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    editable: mayEditExperiment(
      viewer,
      row.ownerId,
      row.project.id,
      ledProjectIds,
    ),
  };
}

export interface MemberWorkspace {
  experiments: MemberExperiment[];
  /** Projects the viewer could record an experiment against. */
  projects: Array<{ id: string; title: string }>;
}

export async function getMemberWorkspace(
  viewer: Viewer,
): Promise<MemberWorkspace | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const { projectIds, ledProjectIds, projects } = await reach(memberId);
  if (projectIds.length === 0) return { experiments: [], projects };

  const rows = await getDb().experiment.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { updatedAt: "desc" },
    take: EXPERIMENTS_LIMIT,
    select: SELECT,
  });

  return {
    experiments: rows.map((row) => shape(row as Row, viewer, ledProjectIds)),
    projects,
  };
}

export async function getMemberExperiment(
  viewer: Viewer,
  id: string,
): Promise<{ experiment: MemberExperiment; log: ExperimentLogEntry[] } | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const { projectIds, ledProjectIds } = await reach(memberId);
  if (projectIds.length === 0) return null;

  const row = await getDb().experiment.findFirst({
    // The membership check is in the query, not after it: an experiment on
    // somebody else's project is not found rather than hidden.
    where: { id, projectId: { in: projectIds } },
    select: SELECT,
  });
  if (!row) return null;

  const log = await getDb().experimentLog.findMany({
    where: { experimentId: id },
    orderBy: { createdAt: "desc" },
    take: LOG_PAGE_SIZE,
    select: { id: true, body: true, createdAt: true },
  });

  return { experiment: shape(row as Row, viewer, ledProjectIds), log };
}
