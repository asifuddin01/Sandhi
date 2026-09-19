/**
 * The publication workflow, as data. Pure, so the editor (a client component),
 * the list, and the server actions all read one definition.
 */

import { PUBLICATION_TYPES, type PublicationType } from "@/lib/bibtex";
import type { ImportedPublication } from "@/lib/scholarly-import";

/**
 * The stages from the specification, shown as a numbered thread. The order is
 * the order the editor offers and the order a publication moves through.
 */
export const PUBLICATION_STAGES = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "SUBMITTED",
  "ACCEPTED",
  "PUBLISHED",
] as const;

export type PublicationStageValue = (typeof PUBLICATION_STAGES)[number];

export const publicationStageLabels: Record<PublicationStageValue, string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal review",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  PUBLISHED: "Published",
};

export const publicationTypeLabels: Record<PublicationType, string> = {
  CONFERENCE: "Conference",
  JOURNAL: "Journal",
  WORKSHOP: "Workshop",
  PREPRINT: "Preprint",
  TECHNICAL_REPORT: "Technical report",
  DATASET: "Dataset",
  BENCHMARK: "Benchmark",
  THESIS: "Thesis",
};

export function parsePublicationType(value: unknown): PublicationType | null {
  return PUBLICATION_TYPES.includes(value as PublicationType)
    ? (value as PublicationType)
    : null;
}

export function parsePublicationStage(
  value: unknown,
): PublicationStageValue | null {
  return PUBLICATION_STAGES.includes(value as PublicationStageValue)
    ? (value as PublicationStageValue)
    : null;
}

/** The decisions a reviewer records. `ChangeStatus.PENDING` is the default. */
export const REVIEW_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export function parseReviewDecision(value: unknown): ReviewDecision | null {
  return REVIEW_DECISIONS.includes(value as ReviewDecision)
    ? (value as ReviewDecision)
    : null;
}

export const reviewDecisionLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** What a DOI or arXiv lookup left in the editor. */
export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; publication: ImportedPublication };

export const idleImportState: ImportState = { status: "idle" };
