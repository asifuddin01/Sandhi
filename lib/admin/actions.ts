import "server-only";

import { updateTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { AuthorizationError, authorize, type Viewer } from "@/lib/authz";
import type { CacheTag } from "@/lib/cache-tags";
import type { Capability } from "@/lib/permissions";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const idleActionState: ActionState = { status: "idle" };

/** A refusal whose message is safe and useful to show the administrator. */
export class AdminActionError extends Error {}

/**
 * Runs an administrative mutation: authorizes on the server first, then turns
 * expected refusals into form messages and anything unexpected into a
 * generic one (with the detail logged, never shown).
 */
export async function runAdminAction(
  capability: Capability,
  work: (viewer: Viewer) => Promise<ActionState>,
): Promise<ActionState> {
  let viewer: Viewer;
  try {
    viewer = await authorize(capability);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  try {
    return await work(viewer);
  } catch (error) {
    if (error instanceof AdminActionError) {
      return { status: "error", message: error.message };
    }
    console.error(`[admin] ${capability} action failed:`, error);
    return {
      status: "error",
      message: "That change could not be saved. Please try again.",
    };
  }
}

export async function recordAudit(
  client: Prisma.TransactionClient,
  entry: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    diff?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await client.auditLog.create({ data: entry });
}

/** Expires public data immediately so editors see their own changes. */
export function invalidate(...tags: CacheTag[]): void {
  for (const tag of new Set(tags)) updateTag(tag);
}
