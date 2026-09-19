"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/admin/actions";
import { authorize, AuthorizationError, type Viewer } from "@/lib/authz";
import { cacheTags } from "@/lib/cache-tags";
import { invalidate } from "@/lib/admin/actions";
import { getDb } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";
import {
  MAX_UPDATE_BODY,
  MAX_UPDATE_NEXT,
  MAX_UPDATE_TITLE,
} from "@/lib/portal/progress-limits";
import { canEditUpdate, onProject } from "@/lib/portal/progress";

export type ProgressState = ActionState;

class ProgressError extends Error {}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function run(
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
      message: "Posting an update needs a lab profile on your account.",
    };
  }

  try {
    return await work(viewer);
  } catch (error) {
    if (error instanceof ProgressError) {
      return { status: "error", message: error.message };
    }
    console.error("[progress] action failed:", error);
    return {
      status: "error",
      message: "That could not be saved. Please try again.",
    };
  }
}

function readUpdate(formData: FormData) {
  const title = field(formData, "title").trim();
  if (!title) throw new ProgressError("Give the update a heading.");
  if (title.length > MAX_UPDATE_TITLE) {
    throw new ProgressError(
      `Keep the heading under ${MAX_UPDATE_TITLE} characters.`,
    );
  }
  const body = field(formData, "body");
  if (!body.trim()) throw new ProgressError("Say what happened.");
  if (body.length > MAX_UPDATE_BODY) {
    throw new ProgressError("That update is too long to save.");
  }
  const nextUp = field(formData, "nextUp").trim();
  if (nextUp.length > MAX_UPDATE_NEXT) {
    throw new ProgressError("Keep what comes next shorter.");
  }
  return { title, body, nextUp: nextUp || null };
}

export async function postProjectUpdateAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");

  const result = await run(async (viewer) => {
    const db = getDb();
    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!project || !(await onProject(viewer, project.id))) {
      throw new ProgressError("You are not on that project.");
    }

    const { title, body, nextUp } = readUpdate(formData);
    await db.projectUpdate.create({
      data: {
        projectId: project.id,
        authorId: workspaceMemberId(viewer)!,
        title,
        body,
        nextUp,
        // The stage it was written at, so the history still reads correctly
        // after the project moves on.
        stage: project.status,
        // Deliberately internal. Publishing is its own decision.
        isPublic: false,
      },
    });
    return { status: "success", message: "Posted to the team." };
  });

  revalidatePath(`/portal/projects/${slug}`);
  return result;
}

/**
 * Publishing an update, or taking it back. Separate from writing it, so a
 * working note never becomes a public statement in the same keystroke.
 */
export async function setUpdateVisibilityAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const id = field(formData, "id");
  const makePublic = field(formData, "isPublic") === "yes";

  const result = await run(async (viewer) => {
    const { allowed } = await canEditUpdate(viewer, id);
    if (!allowed) {
      throw new ProgressError(
        "Only whoever wrote an update, or a project lead, can publish it.",
      );
    }
    await getDb().projectUpdate.update({
      where: { id },
      data: { isPublic: makePublic },
    });
    invalidate(cacheTags.projects);
    return {
      status: "success",
      message: makePublic
        ? "Published. It now appears on the project's public page."
        : "Withdrawn. It is internal again.",
    };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}

export async function deleteProjectUpdateAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const id = field(formData, "id");

  const result = await run(async (viewer) => {
    const { allowed } = await canEditUpdate(viewer, id);
    if (!allowed) {
      throw new ProgressError("That update is not yours to delete.");
    }
    await getDb().projectUpdate.delete({ where: { id } });
    invalidate(cacheTags.projects);
    return { status: "success", message: "Deleted." };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}
