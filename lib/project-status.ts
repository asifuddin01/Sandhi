/**
 * The project lifecycle and the one set of words the site uses for it. Kept
 * out of `lib/public-research.ts` so client components can read it too, and
 * in one place so a list badge and a stage thread never call the same state
 * by two different names.
 */
export const PROJECT_STATUSES = [
  "PROPOSED",
  "ACTIVE",
  "COMPLETED",
  "SUBMITTED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Proposed",
  ACTIVE: "Under way",
  COMPLETED: "Complete",
  SUBMITTED: "Submitted",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/** The stages a project walks through; archived is a sidetrack, not a step. */
export const PROJECT_STAGE_WALK = [
  "PROPOSED",
  "ACTIVE",
  "COMPLETED",
  "SUBMITTED",
  "PUBLISHED",
] as const;

export function projectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export function isProjectStatus(value: string): value is ProjectStatusValue {
  return PROJECT_STATUSES.some((status) => status === value);
}

/**
 * The finer step inside a running project. "Under way" covers a year of very
 * different work, and this is what the team actually wants to say: we have
 * the data, we are training, we are writing.
 */
export const RESEARCH_PHASES = [
  "PROPOSAL_ACCEPTED",
  "DESIGN",
  "DATA",
  "TRAINING",
  "ANALYSIS",
  "WRITING",
  "MANUSCRIPT_READY",
] as const;

export type ResearchPhaseValue = (typeof RESEARCH_PHASES)[number];

export const RESEARCH_PHASE_LABELS: Record<string, string> = {
  PROPOSAL_ACCEPTED: "Proposal accepted",
  DESIGN: "Design and setup",
  DATA: "Data",
  TRAINING: "Training and experiments",
  ANALYSIS: "Analysis",
  WRITING: "Writing",
  MANUSCRIPT_READY: "Manuscript ready",
};

export function researchPhaseLabel(
  phase: string | null | undefined,
): string | null {
  if (!phase) return null;
  return RESEARCH_PHASE_LABELS[phase] ?? phase;
}

export function isResearchPhase(value: string): value is ResearchPhaseValue {
  return RESEARCH_PHASES.some((phase) => phase === value);
}
