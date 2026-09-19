/**
 * Field limits for a progress update. Their own module, with no `server-only`
 * import: the form that enforces them in the browser and the action that
 * enforces them on the server must agree, and a client component cannot reach
 * into `lib/portal/progress.ts`.
 */
export const MAX_UPDATE_TITLE = 200;
export const MAX_UPDATE_BODY = 20_000;
export const MAX_UPDATE_NEXT = 2000;

/** How many files one update carries before it should be two updates. */
export const MAX_ATTACHMENTS = 8;

/** How much a standing section of a project may say. */
export const MAX_SECTION_TITLE = 120;
export const MAX_SECTION_BODY = 40_000;
export const MAX_SECTIONS = 20;

/**
 * The parts a research project usually explains, offered as a starting point.
 * A team can name a section anything; these are the ones they reach for.
 */
export const SECTION_PRESETS = [
  "Methodology",
  "Architecture",
  "Datasets",
  "Experiments",
  "Evaluation",
  "Results",
  "Limitations",
  "Reproducibility",
] as const;
