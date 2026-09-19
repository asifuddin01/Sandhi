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
