"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/admin/actions";
import { authorize, AuthorizationError, type Viewer } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { MAX_SOURCE_LENGTH } from "@/lib/diagrams/mermaid-source";
import { memberProjectIds, workspaceMemberId } from "@/lib/portal-content";
import { MAX_DIAGRAM_TITLE, ownsDiagram } from "@/lib/portal/diagrams";

/**
 * The same shape administration uses, so one message component serves both.
 * A `"use server"` file may export only async functions, so the idle value
 * lives with the components that need it, not here.
 */
export type DiagramState = ActionState;

class DiagramError extends Error {}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Runs a member's own mutation: authorises, then turns expected refusals into
 * a message and anything unexpected into a generic one, as `runAdminAction`
 * does for administration.
 */
async function run(
  work: (viewer: Viewer) => Promise<DiagramState>,
): Promise<DiagramState> {
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
      message: "Diagrams need a lab profile on your account.",
    };
  }

  try {
    return await work(viewer);
  } catch (error) {
    if (error instanceof DiagramError) {
      return { status: "error", message: error.message };
    }
    console.error("[diagrams] action failed:", error);
    return {
      status: "error",
      message: "That could not be saved. Please try again.",
    };
  }
}

function readTitle(formData: FormData): string {
  const title = field(formData, "title").trim();
  if (!title) throw new DiagramError("Give the diagram a name.");
  if (title.length > MAX_DIAGRAM_TITLE) {
    throw new DiagramError(
      `Keep the name under ${MAX_DIAGRAM_TITLE} characters.`,
    );
  }
  return title;
}

function readSource(formData: FormData): string {
  const source = field(formData, "source");
  if (!source.trim()) throw new DiagramError("The diagram is empty.");
  if (source.length > MAX_SOURCE_LENGTH) {
    throw new DiagramError("That diagram is too large to save.");
  }
  return source;
}

/** A project the viewer is not on is refused, not silently dropped. */
async function readProjectId(
  viewer: Viewer,
  formData: FormData,
): Promise<string | null> {
  const projectId = field(formData, "projectId").trim();
  if (!projectId) return null;
  const allowed = await memberProjectIds(viewer);
  if (!allowed.includes(projectId)) {
    throw new DiagramError("You are not on that project.");
  }
  return projectId;
}

export async function createDiagramAction(
  _previous: DiagramState,
  formData: FormData,
): Promise<DiagramState> {
  let createdId: string | null = null;

  const result = await run(async (viewer) => {
    const diagram = await getDb().diagram.create({
      data: {
        title: readTitle(formData),
        source: readSource(formData),
        ownerId: workspaceMemberId(viewer)!,
        projectId: await readProjectId(viewer, formData),
      },
      select: { id: true },
    });
    createdId = diagram.id;
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/portal/diagrams");
  if (createdId) redirect(`/portal/diagrams/${createdId}`);
  return result;
}

export async function saveDiagramAction(
  _previous: DiagramState,
  formData: FormData,
): Promise<DiagramState> {
  const id = field(formData, "id");

  const result = await run(async (viewer) => {
    if (!(await ownsDiagram(viewer, id))) {
      throw new DiagramError("This diagram is not yours to change.");
    }
    await getDb().diagram.update({
      where: { id },
      data: {
        title: readTitle(formData),
        source: readSource(formData),
        projectId: await readProjectId(viewer, formData),
      },
    });
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/portal/diagrams");
  revalidatePath(`/portal/diagrams/${id}`);
  return result;
}

export async function deleteDiagramAction(
  _previous: DiagramState,
  formData: FormData,
): Promise<DiagramState> {
  const id = field(formData, "id");
  let deleted = false;

  const result = await run(async (viewer) => {
    if (!(await ownsDiagram(viewer, id))) {
      throw new DiagramError("This diagram is not yours to delete.");
    }
    await getDb().diagram.delete({ where: { id } });
    deleted = true;
    return { status: "success", message: "Deleted." };
  });

  revalidatePath("/portal/diagrams");
  if (deleted) redirect("/portal/diagrams");
  return result;
}
