/**
 * Field limits for a meeting. Their own module, with no `server-only`
 * import: the form that enforces them in the browser and the action that
 * enforces them on the server must agree, and a client component cannot
 * reach into `lib/portal/meetings.ts`.
 */
export const MAX_MEETING_TITLE = 160;
export const MAX_MEETING_TEXT = 8_000;
export const MAX_MEETING_LINK = 500;
