"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/admin/actions";
import { authorize, AuthorizationError, type Viewer } from "@/lib/authz";
import { cacheTags } from "@/lib/cache-tags";
import { invalidate } from "@/lib/admin/actions";
import { getDb } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";
import {
  MAX_ATTACHMENTS,
  MAX_SECTION_BODY,
  MAX_SECTION_TITLE,
  MAX_SECTIONS,
  MAX_UPDATE_BODY,
  MAX_UPDATE_NEXT,
  MAX_UPDATE_TITLE,
} from "@/lib/portal/progress-limits";
import { isResearchPhase } from "@/lib/project-status";
import {
  ATTACHMENT_RULES,
  type AttachmentKindInput,
  ATTACHMENT_KINDS,
  MAX_ATTACHMENT_TITLE,
} from "@/lib/portal/attachment-input";
import {
  canEditSection,
  canEditUpdate,
  onProject,
} from "@/lib/portal/progress";
import { assertAttachmentExists } from "@/lib/storage";

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
      select: { id: true, status: true, phase: true },
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
        // The stage and step it was written at, so the history still reads
        // correctly after the project moves on.
        stage: project.status,
        phase: project.phase,
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

const DB_KIND = {
  figure: "FIGURE",
  document: "DOCUMENT",
  data: "DATA",
} as const;

/**
 * Records a file the browser has already put in private storage. The receipt
 * proves this server minted the slot, and the object is read back before a
 * row exists, so a row never points at something that was never uploaded or
 * at bytes that are not what they were declared to be.
 */
export async function attachToUpdateAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const updateId = field(formData, "id").trim();
  const sectionId = field(formData, "sectionId").trim();

  const result = await run(async (viewer) => {
    if (Boolean(updateId) === Boolean(sectionId)) {
      throw new ProgressError("That file has nowhere to go.");
    }
    const { allowed } = sectionId
      ? await canEditSection(viewer, sectionId)
      : await canEditUpdate(viewer, updateId);
    if (!allowed) {
      throw new ProgressError("That is not yours to change.");
    }

    const kind = field(formData, "kind") as AttachmentKindInput;
    if (!(ATTACHMENT_KINDS as readonly string[]).includes(kind)) {
      throw new ProgressError("Choose what kind of file this is.");
    }
    const title = field(formData, "title").trim();
    if (!title)
      throw new ProgressError("Give the file a name people will read.");
    if (title.length > MAX_ATTACHMENT_TITLE) {
      throw new ProgressError("That name is too long.");
    }

    const key = field(formData, "fileKey");
    const uploadToken = field(formData, "uploadToken");
    const contentType = field(formData, "contentType");
    const byteSize = Number(field(formData, "byteSize"));
    if (!key || !uploadToken || !Number.isSafeInteger(byteSize)) {
      throw new ProgressError("That upload did not finish. Try again.");
    }

    try {
      await assertAttachmentExists({ key, kind, contentType, uploadToken });
    } catch (error) {
      throw new ProgressError(
        error instanceof Error
          ? error.message
          : `That ${ATTACHMENT_RULES[kind].label} could not be accepted.`,
      );
    }

    const owner = sectionId ? { sectionId } : { updateId };
    const count = await getDb().attachment.count({ where: owner });
    if (count >= MAX_ATTACHMENTS) {
      throw new ProgressError(
        `That carries at most ${MAX_ATTACHMENTS} files already.`,
      );
    }

    await getDb().attachment.create({
      data: {
        ...owner,
        kind: DB_KIND[kind],
        title,
        fileKey: key,
        contentType,
        byteSize,
        sortOrder: count,
      },
    });
    invalidate(cacheTags.projects);
    return { status: "success", message: `Attached ${title}.` };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}

export async function removeAttachmentAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const attachmentId = field(formData, "attachmentId");

  const result = await run(async (viewer) => {
    const attachment = await getDb().attachment.findUnique({
      where: { id: attachmentId },
      select: { updateId: true, sectionId: true, title: true },
    });
    if (!attachment) throw new ProgressError("That file is already gone.");

    // A file is removed by whoever may change the thing it hangs off: the
    // author or lead for an update, anyone on the project for a section.
    const { allowed } = attachment.sectionId
      ? await canEditSection(viewer, attachment.sectionId)
      : await canEditUpdate(viewer, attachment.updateId!);
    if (!allowed) {
      throw new ProgressError("That file is not yours to remove.");
    }

    // The row goes; the object is swept later by the retention job, which
    // already owns deleting from storage.
    await getDb().attachment.delete({ where: { id: attachmentId } });
    invalidate(cacheTags.projects);
    return { status: "success", message: `Removed ${attachment.title}.` };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}

/**
 * The finer step inside a running project — data, training, writing — set by
 * the team rather than an administrator, because they are the ones who know
 * which week it is. The five-stage status above it stays administrative.
 */
export async function setProjectPhaseAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const phase = field(formData, "phase");

  const result = await run(async (viewer) => {
    const db = getDb();
    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!project || !(await onProject(viewer, project.id))) {
      throw new ProgressError("You are not on that project.");
    }
    if (phase && !isResearchPhase(phase)) {
      throw new ProgressError("Choose a step from the list.");
    }

    await db.project.update({
      where: { id: project.id },
      data: { phase: isResearchPhase(phase) ? phase : null },
    });
    invalidate(cacheTags.projects);
    return {
      status: "success",
      message: phase ? "Step updated." : "Step cleared.",
    };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}

function readSection(formData: FormData) {
  const title = field(formData, "title").trim();
  if (!title) throw new ProgressError("Give the section a heading.");
  if (title.length > MAX_SECTION_TITLE) {
    throw new ProgressError("That heading is too long.");
  }
  const body = field(formData, "body");
  if (!body.trim()) throw new ProgressError("Write something in the section.");
  if (body.length > MAX_SECTION_BODY) {
    throw new ProgressError("That section is too long to save.");
  }
  const diagramId = field(formData, "diagramId").trim() || null;
  return { title, body, diagramId };
}

/**
 * A standing part of the project's account of itself — methodology, datasets,
 * architecture. Unlike an update it is edited in place: it is the current
 * answer, not a dated note.
 */
export async function saveProjectSectionAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const sectionId = field(formData, "sectionId").trim();

  const result = await run(async (viewer) => {
    const db = getDb();
    const { title, body, diagramId } = readSection(formData);

    if (sectionId) {
      const { allowed, projectId } = await canEditSection(viewer, sectionId);
      if (!allowed || !projectId) {
        throw new ProgressError("That section is not yours to change.");
      }
      await db.projectSection.update({
        where: { id: sectionId },
        data: { title, body, diagramId },
      });
      invalidate(cacheTags.projects);
      return { status: "success", message: "Saved." };
    }

    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!project || !(await onProject(viewer, project.id))) {
      throw new ProgressError("You are not on that project.");
    }
    const count = await db.projectSection.count({
      where: { projectId: project.id },
    });
    if (count >= MAX_SECTIONS) {
      throw new ProgressError(
        `A project carries at most ${MAX_SECTIONS} sections.`,
      );
    }

    await db.projectSection.create({
      data: {
        projectId: project.id,
        authorId: workspaceMemberId(viewer)!,
        title,
        body,
        diagramId,
        sortOrder: count,
        // Internal until someone publishes it, like an update.
        isPublic: false,
      },
    });
    invalidate(cacheTags.projects);
    return { status: "success", message: `Added ${title}.` };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}

export async function setSectionVisibilityAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const sectionId = field(formData, "sectionId");
  const makePublic = field(formData, "isPublic") === "yes";

  const result = await run(async (viewer) => {
    const { allowed } = await canEditSection(viewer, sectionId);
    if (!allowed) {
      throw new ProgressError("That section is not yours to change.");
    }
    await getDb().projectSection.update({
      where: { id: sectionId },
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

export async function deleteProjectSectionAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const sectionId = field(formData, "sectionId");

  const result = await run(async (viewer) => {
    const { allowed } = await canEditSection(viewer, sectionId);
    if (!allowed) {
      throw new ProgressError("That section is not yours to delete.");
    }
    await getDb().projectSection.delete({ where: { id: sectionId } });
    invalidate(cacheTags.projects);
    return { status: "success", message: "Deleted." };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}

/** Moving a section up or down the page. */
export async function moveProjectSectionAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const sectionId = field(formData, "sectionId");
  const direction = field(formData, "direction") === "up" ? -1 : 1;

  const result = await run(async (viewer) => {
    const { allowed, projectId } = await canEditSection(viewer, sectionId);
    if (!allowed || !projectId) {
      throw new ProgressError("That section is not yours to move.");
    }

    const db = getDb();
    const sections = await db.projectSection.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const from = sections.findIndex((section) => section.id === sectionId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= sections.length) {
      return { status: "success", message: "Already there." };
    }

    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved!);

    // Every row is rewritten, so the order is exactly the array's order and
    // cannot drift after a delete or an old row with a duplicate index.
    await db.$transaction(
      reordered.map((section, index) =>
        db.projectSection.update({
          where: { id: section.id },
          data: { sortOrder: index },
        }),
      ),
    );
    invalidate(cacheTags.projects);
    return { status: "success", message: "Moved." };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}
