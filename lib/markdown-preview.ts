export const PREVIEW_LIMIT = 160;

/**
 * A Markdown body's opening, as text. Rendering it in a one-line preview would
 * drop a heading or a list into what should be one quiet line — so the marks
 * come out and the words stay words. Used for announcements on the portal and
 * for project updates on the home screen.
 */
export function markdownPreview(body: string): string {
  const text = body
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/[#*_`>~[\]]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return text.length > PREVIEW_LIMIT
    ? `${text.slice(0, PREVIEW_LIMIT).trimEnd()}…`
    : text;
}
