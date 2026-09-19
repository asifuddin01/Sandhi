/**
 * Research proposals: what one is, what may be said about it, and where it can
 * go next. Pure data and pure functions, so the public form, the API route,
 * the review screen and the tests all agree without importing a database.
 */

export const PROPOSAL_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "QUEUED",
  "APPROVED",
  "DECLINED",
  "WITHDRAWN",
] as const;

export type ProposalStatusValue = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatusValue, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "Under review",
  QUEUED: "Queued",
  APPROVED: "Approved",
  DECLINED: "Not taken up",
  WITHDRAWN: "Withdrawn",
};

/** What each state means, in the words the screens use. */
export const PROPOSAL_STATUS_MEANING: Record<ProposalStatusValue, string> = {
  SUBMITTED: "Waiting for someone to pick it up.",
  IN_REVIEW: "A reviewer is reading it.",
  QUEUED: "Worth doing. Posted to the lab so people can say they are in.",
  APPROVED: "Approved and running as a project.",
  DECLINED: "Not taken up. The reason is on the record.",
  WITHDRAWN: "Taken back by whoever sent it.",
};

/**
 * A queued or approved proposal is posted to the lab, and anyone may say they
 * would work on it. Nothing else is: an idea under review is not an invitation.
 */
export const POSTED_STATUSES = ["QUEUED", "APPROVED"] as const;

export function isPosted(status: string): boolean {
  return (POSTED_STATUSES as readonly string[]).includes(status);
}

/**
 * Who may move a proposal where. A reviewer works the queue; only an
 * administrator approves, because approving creates a project and a team.
 */
export const REVIEW_TRANSITIONS = {
  take: { from: ["SUBMITTED", "QUEUED"], to: "IN_REVIEW" },
  queue: { from: ["SUBMITTED", "IN_REVIEW", "DECLINED"], to: "QUEUED" },
  decline: { from: ["SUBMITTED", "IN_REVIEW", "QUEUED"], to: "DECLINED" },
} as const satisfies Record<
  string,
  { from: readonly ProposalStatusValue[]; to: ProposalStatusValue }
>;

export const APPROVE_FROM = ["SUBMITTED", "IN_REVIEW", "QUEUED"] as const;

export type ReviewMove = keyof typeof REVIEW_TRANSITIONS;

export const REVIEW_MOVES = Object.keys(REVIEW_TRANSITIONS) as ReviewMove[];

export function canMove(status: string, move: ReviewMove): boolean {
  return (REVIEW_TRANSITIONS[move].from as readonly string[]).includes(status);
}

export function canApprove(status: string): boolean {
  return (APPROVE_FROM as readonly string[]).includes(status);
}

/** An approved proposal is a project; a project is never un-approved here. */
export function isDecided(status: string): boolean {
  return status === "APPROVED" || status === "WITHDRAWN";
}

export const MAX_PROPOSAL_TITLE = 160;
export const MAX_PROPOSAL_SUMMARY = 600;
export const MAX_PROPOSAL_TEXT = 6000;
export const MAX_PROPOSAL_NAME = 120;
export const MAX_PROPOSAL_AFFILIATION = 160;
export const MAX_INTEREST_NOTE = 600;
export const MAX_DECISION_NOTE = 2000;
