"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Viewer } from "@/lib/authz";
import { slugify, slugProblem } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import {
  INSIGHT_KINDS,
  MAX_INSIGHT_AUTHORS,
  MAX_INSIGHT_BODY,
  MAX_INSIGHT_SUMMARY,
  MAX_INSIGHT_TITLE,
} from "@/lib/insight-content";
import { workspaceMemberId } from "@/lib/portal-content";
import { memberMayEdit, memberMaySubmit } from "@/lib/portal/insights";

import {
  field,
  ProgressError,
  run,
  type ProgressState,
} from "../projects/action-runtime";

/**
 * Writing a research note and handing it over to be read.
 *
 * Nothing here can publish one. A member drafts, then submits; the decision
 * to put a note on the public site belongs to a reviewer, in administration,
 * and this file has no route to it.
 */

/** The note, if it is theirs and still theirs to change. */
async function theirDraft(viewer: Viewer, id: string) {
  const memberId = workspaceMemberId(viewer);
  const row = await getDb().insight.findFirst({
    where: { id, authors: { some: { memberId: memberId ?? "" } } },
    select: { id: true, state: true },
  });
  // Not an author and no such note give the same answer on purpose.
  if (!row) throw new ProgressError("That note is gone.");
  if (!memberMayEdit(row.state)) {
    throw new ProgressError(
      "This note is with the reviewers now. Ask them to send it back if it needs changing.",
    );
  }
  return row;
}

/**
 * The address the note will have. Taken from the title unless somebody typed
 * one, and checked for collisions here rather than left to the database,
 * which would answer with a constraint name.
 */
async function readSlug(formData: FormData, exceptId?: string) {
  const typed = field(formData, "slug").trim();
  const slug = typed ? slugify(typed) : slugify(field(formData, "title"));
  const problem = slugProblem(slug);
  if (problem) throw new ProgressError(problem);

  const clash = await getDb().insight.findFirst({
    where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) {
    throw new ProgressError("A note already has that address. Change it.");
  }
  return slug;
}

function readKind(formData: FormData): string {
  const kind = field(formData, "kind");
  if (!(INSIGHT_KINDS as readonly string[]).includes(kind)) {
    throw new ProgressError("Choose a kind from the list.");
  }
  return kind;
}

function readText(
  formData: FormData,
  name: string,
  label: string,
  limit: number,
): string {
  const value = field(formData, name).trim();
  if (!value) throw new ProgressError(`The ${label} cannot be empty.`);
  if (value.length > limit)
    throw new ProgressError(`Keep the ${label} shorter.`);
  return value;
}

/**
 * Who wrote it. Whoever is filling the form is always on the list and always
 * first: a note nobody is on has no owner, and this is the only place its
 * ownership comes from.
 */
async function readAuthors(
  formData: FormData,
  memberId: string,
): Promise<string[]> {
  const others = [
    ...new Set(
      formData
        .getAll("authorId")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value && value !== memberId),
    ),
  ];
  if (others.length + 1 > MAX_INSIGHT_AUTHORS) {
    throw new ProgressError(`Name at most ${MAX_INSIGHT_AUTHORS} authors.`);
  }
  if (others.length > 0) {
    const real = await getDb().member.findMany({
      where: { id: { in: others } },
      select: { id: true },
    });
    if (real.length !== others.length) {
      throw new ProgressError("One of those authors is not in the lab.");
    }
  }
  return [memberId, ...others];
}

function readFields(formData: FormData) {
  return {
    title: readText(formData, "title", "title", MAX_INSIGHT_TITLE),
    summary: readText(formData, "summary", "summary", MAX_INSIGHT_SUMMARY),
    body: readText(formData, "body", "note", MAX_INSIGHT_BODY),
    kind: readKind(formData) as never,
  };
}

export async function createInsightAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  let created = "";

  const result = await run(async (viewer) => {
    const memberId = workspaceMemberId(viewer)!;
    const authorIds = await readAuthors(formData, memberId);
    const slug = await readSlug(formData);

    const insight = await getDb().insight.create({
      data: {
        ...readFields(formData),
        slug,
        // A new note is always a draft. Nothing in the portal sets any other
        // state, and publishing is not this file's to do.
        state: "DRAFT",
        authors: {
          create: authorIds.map((id, position) => ({
            memberId: id,
            position,
          })),
        },
      },
      select: { id: true },
    });
    created = insight.id;
    return { status: "success", message: "Draft started." };
  });

  revalidatePath("/portal/insights");
  if (created) redirect(`/portal/insights/${created}`);
  return result;
}

export async function updateInsightAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "insightId");

  const result = await run(async (viewer) => {
    await theirDraft(viewer, id);
    const memberId = workspaceMemberId(viewer)!;
    const authorIds = await readAuthors(formData, memberId);
    const slug = await readSlug(formData, id);

    const db = getDb();
    await db.$transaction([
      db.insight.update({
        where: { id },
        data: { ...readFields(formData), slug },
      }),
      // The author list is replaced whole, so the form says who wrote it now
      // rather than what changed about who wrote it.
      db.insightAuthor.deleteMany({ where: { insightId: id } }),
      db.insightAuthor.createMany({
        data: authorIds.map((memberId2, position) => ({
          insightId: id,
          memberId: memberId2,
          position,
        })),
      }),
    ]);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/portal/insights");
  revalidatePath(`/portal/insights/${id}`);
  return result;
}

/**
 * Handing the note over. It stops being editable at this point, which is the
 * whole purpose: a reviewer reads a version that cannot change underneath
 * them.
 */
export async function submitInsightAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "insightId");

  const result = await run(async (viewer) => {
    const memberId = workspaceMemberId(viewer);
    const row = await getDb().insight.findFirst({
      where: { id, authors: { some: { memberId: memberId ?? "" } } },
      select: { state: true },
    });
    if (!row) throw new ProgressError("That note is gone.");
    if (!memberMaySubmit(row.state)) {
      throw new ProgressError("That note has already been sent.");
    }

    await getDb().insight.update({
      where: { id },
      data: { state: "IN_REVIEW" },
    });
    return {
      status: "success",
      message: "Sent to be read. You will not be able to change it now.",
    };
  });

  revalidatePath("/portal/insights");
  revalidatePath(`/portal/insights/${id}`);
  return result;
}

export async function deleteInsightAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "insightId");

  const result = await run(async (viewer) => {
    await theirDraft(viewer, id);
    await getDb().insight.delete({ where: { id } });
    return { status: "success", message: "Deleted." };
  });

  revalidatePath("/portal/insights");
  // The page this was pressed on is about a note that no longer exists. The
  // redirect sits outside `run`, which swallows every error it does not
  // recognise — and `redirect` works by throwing one.
  if (result.status === "success") redirect("/portal/insights");
  return result;
}
