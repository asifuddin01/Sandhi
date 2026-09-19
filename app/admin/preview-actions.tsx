"use server";

import { Prose } from "@/components/Prose";
import { authorize, AuthorizationError } from "@/lib/authz";

/** The longest Markdown body the editors accept. */
const MAX_PREVIEW_LENGTH = 100_000;

/**
 * Live preview for the Markdown editors: rendered on the server by the same
 * component as the public pages, so sanitising, maths, and code highlighting
 * match exactly.
 */
export async function previewMarkdownAction(text: string) {
  try {
    await authorize("admin:access");
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
  if (typeof text !== "string" || !text.trim()) return null;
  return <Prose>{text.slice(0, MAX_PREVIEW_LENGTH)}</Prose>;
}
