/**
 * Field limits for an experiment. Their own module, with no `server-only`
 * import: the form that enforces them in the browser and the action that
 * enforces them on the server must agree, and a client component cannot
 * reach into `lib/portal/experiments.ts`.
 */
export const MAX_EXPERIMENT_NAME = 200;
export const MAX_HYPOTHESIS = 2_000;
export const MAX_MODEL_INFO = 1_000;
export const MAX_NOTES = 20_000;
export const MAX_MILESTONE = 120;
export const MAX_TRACKING_URL = 500;
export const MAX_LOG_ENTRY = 4_000;

/** One dataset per line. */
export const MAX_DATASETS = 20;
export const MAX_DATASET_REF = 300;

/**
 * Configuration and results are JSON typed into a textarea. The cap is on
 * the text, before parsing: it bounds the work `JSON.parse` is asked to do
 * as well as the size of what is stored.
 */
export const MAX_JSON_TEXT = 20_000;
