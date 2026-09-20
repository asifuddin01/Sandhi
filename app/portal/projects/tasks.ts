"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { fromDhakaInput } from "@/lib/dhaka-time";
import { can } from "@/lib/permissions";
import { workspaceMemberId } from "@/lib/portal-content";
import {
  isTaskPriority,
  isTaskStatus,
  MAX_TASK_DESCRIPTION,
  MAX_TASK_TITLE,
} from "@/lib/portal/progress-limits";
import { leadsProject, onProject, taskProjectId } from "@/lib/portal/progress";
import type { Viewer } from "@/lib/authz";

import {
  field,
  ProgressError,
  run,
  type ProgressState,
} from "./action-runtime";

/**
 * Work assigned on a project. A research lead hands work out, and so does an
 * assistant research lead — that is what the role is for. Everyone on the
 * project can move their own task along, because a board only tells the truth
 * if the person doing the work can say where it is.
 */

async function project(slug: string) {
  const row = await getDb().project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!row) throw new ProgressError("That project does not exist.");
  return row;
}

/**
 * The people a task is being put on. Every one of them has to be on the
 * project: a task is work for this team, and the list in the form is a
 * suggestion the server does not take on trust.
 */
async function readAssignees(
  formData: FormData,
  projectId: string,
): Promise<string[]> {
  const asked = [
    ...new Set(
      formData
        .getAll("assigneeId")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (asked.length === 0) return [];

  const onTeam = await getDb().projectMember.findMany({
    where: { projectId, memberId: { in: asked } },
    select: { memberId: true },
  });
  if (onTeam.length !== asked.length) {
    throw new ProgressError("Assign it to people on this project.");
  }
  return onTeam.map((person) => person.memberId);
}

async function requireLead(viewer: Viewer, projectId: string) {
  if (await leadsProject(viewer, projectId)) return;
  // An administrator organises teams across the lab, so they lead here too.
  if (can(viewer.role, "projects:manage")) return;
  throw new ProgressError(
    "Only the research lead, an assistant lead, or an administrator can do that.",
  );
}

export async function createTaskAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");

  const result = await run(async (viewer) => {
    const { id: projectId } = await project(slug);
    await requireLead(viewer, projectId);

    const title = field(formData, "title").trim();
    if (!title) throw new ProgressError("Say what the task is.");
    if (title.length > MAX_TASK_TITLE) {
      throw new ProgressError("That task title is too long.");
    }
    const description = field(formData, "description").trim();
    if (description.length > MAX_TASK_DESCRIPTION) {
      throw new ProgressError("Keep the detail shorter.");
    }
    const priority = field(formData, "priority") || "MEDIUM";
    if (!isTaskPriority(priority)) {
      throw new ProgressError("Choose a priority from the list.");
    }

    const assigneeIds = await readAssignees(formData, projectId);

    const dueValue = field(formData, "dueAt").trim();
    const dueAt = dueValue ? fromDhakaInput(`${dueValue}T17:00`) : null;
    if (dueValue && !dueAt) throw new ProgressError("That date is not a date.");

    const count = await getDb().task.count({ where: { projectId } });
    await getDb().task.create({
      data: {
        projectId,
        title,
        description: description || null,
        priority,
        assignees: { create: assigneeIds.map((memberId) => ({ memberId })) },
        dueAt,
        createdById: workspaceMemberId(viewer),
        sortOrder: count,
      },
    });
    return { status: "success", message: "Task added." };
  });

  revalidatePath(`/portal/projects/${slug}`);
  return result;
}

/**
 * Moving a task along. Whoever it belongs to may do this, as may a lead: the
 * person doing the work is the one who knows it is done.
 */
export async function setTaskStatusAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const taskId = field(formData, "taskId");
  const status = field(formData, "status");

  const result = await run(async (viewer) => {
    if (!isTaskStatus(status)) {
      throw new ProgressError("Choose a state from the list.");
    }
    const projectId = await taskProjectId(taskId);
    if (!projectId || !(await onProject(viewer, projectId))) {
      throw new ProgressError("That task is not on a project of yours.");
    }

    const memberId = workspaceMemberId(viewer);
    const mine = await getDb().taskAssignee.findFirst({
      where: { taskId, memberId: memberId ?? "" },
      select: { memberId: true },
    });
    if (!mine) await requireLead(viewer, projectId);

    await getDb().task.update({ where: { id: taskId }, data: { status } });
    return { status: "success", message: "Updated." };
  });

  revalidatePath(`/portal/projects/${slug}`);
  return result;
}

/**
 * Who a task is on — one person or several. The whole set is replaced, so the
 * form says what the task's team is now rather than what changed about it.
 */
export async function assignTaskAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const taskId = field(formData, "taskId");

  const result = await run(async (viewer) => {
    const projectId = await taskProjectId(taskId);
    if (!projectId) throw new ProgressError("That task is already gone.");
    await requireLead(viewer, projectId);

    const assigneeIds = await readAssignees(formData, projectId);
    const db = getDb();
    await db.$transaction([
      db.taskAssignee.deleteMany({ where: { taskId } }),
      db.taskAssignee.createMany({
        data: assigneeIds.map((memberId) => ({ taskId, memberId })),
      }),
    ]);

    return {
      status: "success",
      message:
        assigneeIds.length === 0
          ? "Left unassigned."
          : `Assigned to ${assigneeIds.length} ${assigneeIds.length === 1 ? "person" : "people"}.`,
    };
  });

  revalidatePath(`/portal/projects/${slug}`);
  return result;
}

export async function deleteTaskAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const taskId = field(formData, "taskId");

  const result = await run(async (viewer) => {
    const projectId = await taskProjectId(taskId);
    if (!projectId) throw new ProgressError("That task is already gone.");
    await requireLead(viewer, projectId);

    await getDb().task.delete({ where: { id: taskId } });
    return { status: "success", message: "Deleted." };
  });

  revalidatePath(`/portal/projects/${slug}`);
  return result;
}

/**
 * Appointing an assistant research lead, or standing one down. A lead may
 * appoint one, and so may an administrator; nobody appoints themselves, and
 * the research lead itself is set in administration, where teams are formed.
 */
export async function setAssistantLeadAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const slug = field(formData, "slug");
  const memberId = field(formData, "memberId");
  const appoint = field(formData, "appoint") === "yes";

  const result = await run(async (viewer) => {
    const { id: projectId } = await project(slug);
    await requireLead(viewer, projectId);

    if (memberId === workspaceMemberId(viewer)) {
      throw new ProgressError("Someone else has to appoint you.");
    }

    const membership = await getDb().projectMember.findUnique({
      where: { projectId_memberId: { projectId, memberId } },
      select: { isLead: true, member: { select: { name: true } } },
    });
    if (!membership) {
      throw new ProgressError("That person is not on this project.");
    }
    if (membership.isLead) {
      throw new ProgressError("They already lead this project.");
    }

    await getDb().projectMember.update({
      where: { projectId_memberId: { projectId, memberId } },
      data: { isAssistantLead: appoint },
    });
    return {
      status: "success",
      message: appoint
        ? `${membership.member.name} is now an assistant lead.`
        : `${membership.member.name} is no longer an assistant lead.`,
    };
  });

  revalidatePath(`/portal/projects/${slug}`);
  revalidatePath(`/projects/${slug}`);
  return result;
}
