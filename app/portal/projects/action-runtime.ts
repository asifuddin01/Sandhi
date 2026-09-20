import "server-only";

import type { ActionState } from "@/lib/admin/actions";
import { authorize, AuthorizationError, type Viewer } from "@/lib/authz";
import { workspaceMemberId } from "@/lib/portal-content";

/**
 * What every project-workspace action shares. It lives outside the action
 * files because a `"use server"` module may export only async functions, and
 * a refusal is a class.
 */

export type ProgressState = ActionState;

/** A refusal whose message is safe and useful to show the person. */
export class ProgressError extends Error {}

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function run(
  work: (viewer: Viewer) => Promise<ProgressState>,
): Promise<ProgressState> {
  let viewer: Viewer;
  try {
    viewer = await authorize("portal:access");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  if (!workspaceMemberId(viewer)) {
    return {
      status: "error",
      message: "This needs a lab profile on your account.",
    };
  }

  try {
    return await work(viewer);
  } catch (error) {
    if (error instanceof ProgressError) {
      return { status: "error", message: error.message };
    }
    console.error("[portal] project action failed:", error);
    return {
      status: "error",
      message: "That could not be saved. Please try again.",
    };
  }
}
