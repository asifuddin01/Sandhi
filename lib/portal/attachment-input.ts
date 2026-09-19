import { z } from "zod";

/**
 * What the browser may ask for when it wants somewhere to put a file. Shared
 * by the route that mints the upload slot and the form that asks for one, so
 * the two cannot drift apart. Every value here is checked again on the server
 * against the stored object before a row is written.
 */

export const ATTACHMENT_KINDS = ["figure", "document", "data"] as const;

export type AttachmentKindInput = (typeof ATTACHMENT_KINDS)[number];

export const MAX_ATTACHMENT_TITLE = 160;

/** Accepted media types and size ceiling for each attachment kind. */
export const ATTACHMENT_RULES = {
  figure: {
    // No SVG: it is a document that can carry script, and these files are
    // shown inline. A diagram exported from the builder as PNG is accepted.
    types: ["image/png", "image/jpeg", "image/webp"],
    extensions: {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    },
    maximumBytes: 8 * 1024 * 1024,
    label: "figure",
  },
  document: {
    types: ["application/pdf", "text/markdown", "text/plain"],
    extensions: {
      "application/pdf": "pdf",
      "text/markdown": "md",
      "text/plain": "txt",
    },
    maximumBytes: 20 * 1024 * 1024,
    label: "document",
  },
  data: {
    types: [
      "text/csv",
      "text/tab-separated-values",
      "application/json",
      "application/x-ndjson",
    ],
    extensions: {
      "text/csv": "csv",
      "text/tab-separated-values": "tsv",
      "application/json": "json",
      "application/x-ndjson": "ndjson",
    },
    maximumBytes: 20 * 1024 * 1024,
    label: "data file",
  },
} as const satisfies Record<
  AttachmentKindInput,
  {
    types: readonly string[];
    extensions: Record<string, string>;
    maximumBytes: number;
    label: string;
  }
>;

export type AttachmentUploadKind = AttachmentKindInput;

export function attachmentExtension(
  kind: AttachmentKindInput,
  contentType: string,
): string | null {
  const rules = ATTACHMENT_RULES[kind];
  return (rules.extensions as Record<string, string>)[contentType] ?? null;
}

export const attachmentUploadSchema = z
  .object({
    projectSlug: z.string().trim().min(1).max(200),
    kind: z.enum(ATTACHMENT_KINDS),
    contentType: z.string().trim().min(1).max(120),
    size: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    const rules = ATTACHMENT_RULES[value.kind];
    if (!(rules.types as readonly string[]).includes(value.contentType)) {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: `That file type is not accepted as a ${rules.label}.`,
      });
    }
    if (value.size > rules.maximumBytes) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: `A ${rules.label} must be under ${Math.round(
          rules.maximumBytes / (1024 * 1024),
        )} MB.`,
      });
    }
  });

/** What the picker offers for each kind, as an `accept` attribute. */
export function acceptFor(kind: AttachmentKindInput): string {
  return ATTACHMENT_RULES[kind].types.join(",");
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(kb / 1024 < 10 ? 1 : 0)} MB`;
}
