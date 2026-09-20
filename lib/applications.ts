import { joinInterestTypes } from "@/lib/forms";

/**
 * What an application is, as the lab reads it. Nothing here touches the
 * database or the session, so the review forms can import it — which is the
 * point: the queue, the detail page and the server actions all agree on what
 * the states are called, and cannot drift apart.
 *
 * Nothing about an application is ever public. Somebody wrote to the lab
 * about themselves; it is read only by people with `applications:manage`.
 */

export const APPLICATION_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
  "ACCEPTED",
  "REJECTED",
  "INVITED",
  "WITHDRAWN",
] as const;

export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<
  ApplicationStatusValue,
  string
> = {
  NEW: "New",
  IN_REVIEW: "Being read",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  ACCEPTED: "Accepted",
  REJECTED: "Not this time",
  INVITED: "Invited",
  WITHDRAWN: "Withdrawn",
};

/** Still waiting on the lab for an answer. */
export const OPEN_STATUSES: readonly ApplicationStatusValue[] = [
  "NEW",
  "IN_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
];

/**
 * Only an accepted applicant is offered an invitation. Inviting somebody the
 * lab has not decided about is how a queue stops meaning anything.
 */
export function canInvite(status: string): boolean {
  return status === "ACCEPTED";
}

export function isApplicationStatus(
  value: string,
): value is ApplicationStatusValue {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export const APPLICATION_TYPES = joinInterestTypes.map(({ value }) => value);

/** The paths, with their names, for a filter row. */
export const joinTypeOptions = joinInterestTypes.map(({ value, label }) => ({
  value,
  label,
}));

export const APPLICATION_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(
    joinInterestTypes.map(({ value, label }) => [value, label]),
  );

export function typeLabel(type: string): string {
  return APPLICATION_TYPE_LABELS[type] ?? type;
}

export function isApplicationType(value: string): boolean {
  return (APPLICATION_TYPES as readonly string[]).includes(value);
}

export const MAX_APPLICATION_NOTE = 4000;

/** What a rating means, so a number in a list is not a private code. */
export const RATING_LABELS: Record<number, string> = {
  1: "1 — no",
  2: "2 — probably not",
  3: "3 — worth discussing",
  4: "4 — yes",
  5: "5 — strongly yes",
};

export const RATINGS = [1, 2, 3, 4, 5] as const;

export function isRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/** The two files an applicant may have attached. */
export const APPLICATION_FILES = ["cv", "proposal"] as const;

export type ApplicationFileKind = (typeof APPLICATION_FILES)[number];

export function isApplicationFileKind(
  value: string,
): value is ApplicationFileKind {
  return (APPLICATION_FILES as readonly string[]).includes(value);
}
