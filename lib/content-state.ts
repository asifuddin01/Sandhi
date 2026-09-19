/**
 * Publishing rules shared by every content manager. Pure, so the admin
 * forms and the public visibility rules are tested against the same code.
 */

export const publishStates = [
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type PublishStateValue = (typeof publishStates)[number];

export const publishStateLabels: Record<PublishStateValue, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/** Records without a publish time cannot be scheduled. */
export const unscheduledStates = publishStates.filter(
  (state) => state !== "SCHEDULED",
);

export function parsePublishState(
  value: unknown,
  allowed: readonly PublishStateValue[] = publishStates,
): PublishStateValue | null {
  return allowed.includes(value as PublishStateValue)
    ? (value as PublishStateValue)
    : null;
}

export type PublicStatus = "live" | "scheduled" | "hidden";

/**
 * What the public sees now. Scheduled records (or published ones with a
 * future time) go live on their own once the time passes; no job runs.
 */
export function publicStatus(
  state: PublishStateValue,
  publishAt: Date | null,
  now = new Date(),
): PublicStatus {
  if (state === "PUBLISHED") {
    return publishAt && publishAt > now ? "scheduled" : "live";
  }
  if (state === "SCHEDULED" && publishAt) {
    return publishAt > now ? "scheduled" : "live";
  }
  return "hidden";
}

export function scheduleProblem(
  state: PublishStateValue,
  publishAt: Date | null,
  now = new Date(),
): string | null {
  if (state !== "SCHEDULED") return null;
  if (!publishAt) return "Choose when it should be published.";
  if (publishAt <= now) {
    return "Choose a publish time in the future, or publish it now.";
  }
  return null;
}

export const SLUG_MAX_LENGTH = 80;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** A readable address from a title: "Sparse Attention, Revisited" → "sparse-attention-revisited". */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/u, "");
}

export function slugProblem(slug: string): string | null {
  if (!slug) return "Enter an address for the page.";
  if (slug.length > SLUG_MAX_LENGTH) {
    return `Keep the address under ${SLUG_MAX_LENGTH} characters.`;
  }
  if (!slugPattern.test(slug)) {
    return "Use lowercase letters, numbers, and single hyphens in the address.";
  }
  return null;
}

export const bulkActions = ["publish", "draft", "archive", "delete"] as const;
export type BulkAction = (typeof bulkActions)[number];

export const bulkActionLabels: Record<BulkAction, string> = {
  publish: "Publish now",
  draft: "Move to draft",
  archive: "Archive",
  delete: "Delete drafts and archived",
};

export function parseBulkAction(value: unknown): BulkAction | null {
  return bulkActions.includes(value as BulkAction)
    ? (value as BulkAction)
    : null;
}

/** Only unpublished records may be deleted; published ones are archived. */
export function deletable(state: PublishStateValue): boolean {
  return state === "DRAFT" || state === "ARCHIVED";
}
