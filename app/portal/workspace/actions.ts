"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Viewer } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { workspaceMemberId } from "@/lib/portal-content";
import {
  MAX_EXPERIMENT_NAME,
  MAX_HYPOTHESIS,
  MAX_LOG_ENTRY,
  MAX_MILESTONE,
  MAX_MODEL_INFO,
  MAX_NOTES,
} from "@/lib/portal/experiment-limits";
import {
  parseDatasets,
  parseJsonField,
  parseTrackingUrl,
  type Parsed,
} from "@/lib/portal/experiment-input";
import { mayEditExperiment } from "@/lib/portal/experiments";
import { leadsProject, onProject } from "@/lib/portal/progress";

import {
  field,
  ProgressError,
  run,
  type ProgressState,
} from "../projects/action-runtime";

/**
 * Recording research: what was tried, and what happened next.
 *
 * Anyone on a project may record an experiment there — it is their own work.
 * Changing one afterwards is `mayEditExperiment`, the same question the page
 * draws its forms by, so a button that appears and an action that refuses
 * cannot disagree.
 */

async function refuseUnlessOnProject(viewer: Viewer, projectId: string) {
  if (await onProject(viewer, projectId)) return;
  throw new ProgressError("That is not a project of yours.");
}

async function refuseUnlessEditable(viewer: Viewer, id: string) {
  const row = await getDb().experiment.findUnique({
    where: { id },
    select: { ownerId: true, projectId: true },
  });
  if (!row) throw new ProgressError("That experiment is gone.");

  const led = (await leadsProject(viewer, row.projectId))
    ? [row.projectId]
    : [];
  if (mayEditExperiment(viewer, row.ownerId, row.projectId, led)) return row;
  throw new ProgressError(
    "Only whoever is running this experiment, or the project's lead, can change it.",
  );
}

function readText(
  formData: FormData,
  name: string,
  label: string,
  limit: number,
): string | null {
  const value = field(formData, name).trim();
  if (value.length > limit)
    throw new ProgressError(`Keep the ${label} shorter.`);
  return value || null;
}

/** A refusal from the pure readers becomes one the person can act on. */
function taken<T>(result: Parsed<T>): T {
  if (!result.ok) throw new ProgressError(result.message);
  return result.value;
}

/**
 * Prisma distinguishes a column left NULL from a stored JSON `null`, and so
 * does the form: an empty box is "not recorded", the word `null` is a value
 * somebody typed.
 */
function readJson(formData: FormData, name: string, label: string) {
  const { present, value } = taken(
    parseJsonField(field(formData, name), label),
  );
  if (!present) return Prisma.DbNull;
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function readName(formData: FormData): string {
  const name = field(formData, "name").trim();
  if (!name) throw new ProgressError("Give the experiment a name.");
  if (name.length > MAX_EXPERIMENT_NAME) {
    throw new ProgressError("That name is too long.");
  }
  return name;
}

function readShared(formData: FormData) {
  return {
    name: readName(formData),
    hypothesis: readText(formData, "hypothesis", "hypothesis", MAX_HYPOTHESIS),
    config: readJson(formData, "config", "configuration"),
    results: readJson(formData, "results", "results"),
    datasetRefs: taken(parseDatasets(field(formData, "datasetRefs"))),
    modelInfo: readText(formData, "modelInfo", "model detail", MAX_MODEL_INFO),
    notes: readText(formData, "notes", "notes", MAX_NOTES),
    milestone: readText(formData, "milestone", "milestone", MAX_MILESTONE),
    trackingUrl: taken(parseTrackingUrl(field(formData, "trackingUrl"))),
  };
}

export async function createExperimentAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const result = await run(async (viewer) => {
    const projectId = field(formData, "projectId").trim();
    if (!projectId) throw new ProgressError("Say which project this is for.");
    await refuseUnlessOnProject(viewer, projectId);

    await getDb().experiment.create({
      data: {
        ...readShared(formData),
        projectId,
        // Whoever records it is running it, whatever their role.
        ownerId: workspaceMemberId(viewer)!,
      },
    });
    return { status: "success", message: "Experiment recorded." };
  });

  revalidatePath("/portal/workspace");
  return result;
}

export async function updateExperimentAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "experimentId");

  const result = await run(async (viewer) => {
    await refuseUnlessEditable(viewer, id);
    await getDb().experiment.update({
      where: { id },
      data: readShared(formData),
    });
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/portal/workspace");
  revalidatePath(`/portal/workspace/${id}`);
  return result;
}

/**
 * One timestamped line in the experiment's log. Append-only on purpose: a
 * log that can be rewritten is not a record of what happened.
 */
export async function addLogEntryAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "experimentId");

  const result = await run(async (viewer) => {
    await refuseUnlessEditable(viewer, id);

    const body = field(formData, "body").trim();
    if (!body) throw new ProgressError("Say what happened.");
    if (body.length > MAX_LOG_ENTRY) {
      throw new ProgressError("Keep a log entry shorter than that.");
    }

    await getDb().experimentLog.create({
      data: { experimentId: id, body },
    });
    // The experiment has moved on, even if none of its fields changed.
    await getDb().experiment.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return { status: "success", message: "Logged." };
  });

  revalidatePath(`/portal/workspace/${id}`);
  return result;
}

export async function deleteExperimentAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "experimentId");

  const result = await run(async (viewer) => {
    await refuseUnlessEditable(viewer, id);
    await getDb().experiment.delete({ where: { id } });
    return { status: "success", message: "Deleted." };
  });

  revalidatePath("/portal/workspace");
  // The page this was pressed on is about an experiment that no longer
  // exists. The redirect sits outside `run`, which swallows every error it
  // does not recognise — and `redirect` works by throwing one.
  if (result.status === "success") redirect("/portal/workspace");
  return result;
}
