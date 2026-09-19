"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import {
  AdminActionError,
  invalidate,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import {
  changes,
  checkbox,
  field,
  isUniqueConflict,
  oneOf,
  optionalHttpsUrl,
  requiredText,
  runBulk,
} from "@/lib/admin/content-actions";
import { PROJECT_STATUSES } from "@/lib/admin/projects";
import { cacheTags } from "@/lib/cache-tags";
import { slugProblem, unscheduledStates } from "@/lib/content-state";
import { getDb } from "@/lib/db";

const MAX_TEAM = 30;

function optionalMarkdown(
  formData: FormData,
  name: string,
  label: string,
): string | null {
  const value = field(formData, name);
  if (value.length > 50_000) {
    throw new AdminActionError(`${label} is too long to save.`);
  }
  return value.trim() ? value : null;
}

/** A calendar date, stored as midnight UTC. */
function optionalDate(formData: FormData, name: string, label: string) {
  const value = field(formData, name).trim();
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  const date = match
    ? new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      )
    : null;
  if (!date || date.toISOString().slice(0, 10) !== value) {
    throw new AdminActionError(`Enter a valid ${label}.`);
  }
  return date;
}

function strings(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}

async function readProject(formData: FormData, id: string) {
  const title = requiredText(formData, "title", "a title", 200);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);
  const startedAt = optionalDate(formData, "startedAt", "start date");
  const endedAt = optionalDate(formData, "endedAt", "end date");
  if (startedAt && endedAt && endedAt < startedAt) {
    throw new AdminActionError("The project cannot end before it starts.");
  }

  const memberIds = strings(formData, "team.memberId");
  const roles = strings(formData, "team.role");
  const leads = strings(formData, "team.isLead");
  if (memberIds.length > MAX_TEAM) {
    throw new AdminActionError(`List at most ${MAX_TEAM} people.`);
  }
  if (new Set(memberIds).size !== memberIds.length) {
    throw new AdminActionError("Each person can appear on the team once.");
  }
  const team = memberIds.map((memberId, index) => {
    const role = (roles[index] ?? "").trim();
    if (!memberId || !role) {
      throw new AdminActionError("Give every person on the team a role.");
    }
    if (role.length > 80) {
      throw new AdminActionError("Keep each role under 80 characters.");
    }
    return { memberId, role, isLead: leads[index] === "yes", sortOrder: index };
  });

  const areaIds = [...new Set(strings(formData, "areaIds"))];
  const relatedIds = [...new Set(strings(formData, "relatedIds"))].filter(
    (relatedId) => relatedId !== id,
  );
  const db = getDb();
  const [areaCount, memberCount, projectCount] = await Promise.all([
    db.researchArea.count({ where: { id: { in: areaIds } } }),
    db.member.count({ where: { id: { in: memberIds } } }),
    db.project.count({ where: { id: { in: relatedIds } } }),
  ]);
  if (
    areaCount !== areaIds.length ||
    memberCount !== memberIds.length ||
    projectCount !== relatedIds.length
  ) {
    throw new AdminActionError(
      "A chosen area, person, or project no longer exists. Reload and try again.",
    );
  }

  return {
    data: {
      title,
      slug,
      gloss: requiredText(formData, "gloss", "a one-line description", 200),
      abstract: requiredText(formData, "abstract", "an abstract", 1500),
      question: requiredText(
        formData,
        "question",
        "the research question",
        400,
      ),
      motivation: optionalMarkdown(formData, "motivation", "The motivation"),
      approach: optionalMarkdown(formData, "approach", "The approach"),
      experiments: optionalMarkdown(formData, "experiments", "The experiments"),
      results: optionalMarkdown(formData, "results", "The results"),
      resultsPublic: checkbox(formData, "resultsPublic"),
      status: oneOf(
        field(formData, "status"),
        PROJECT_STATUSES,
        "Choose a status.",
      ),
      state: oneOf(
        field(formData, "state"),
        unscheduledStates,
        "Choose a state.",
      ),
      featured: checkbox(formData, "featured"),
      codeUrl: optionalHttpsUrl(formData, "codeUrl", "The code link"),
      datasetUrl: optionalHttpsUrl(formData, "datasetUrl", "The dataset link"),
      demoUrl: optionalHttpsUrl(formData, "demoUrl", "The demo link"),
      startedAt,
      endedAt,
    },
    areaIds,
    team,
    relatedIds,
  };
}

function relations(
  areaIds: string[],
  team: Array<{
    memberId: string;
    role: string;
    isLead: boolean;
    sortOrder: number;
  }>,
  relatedIds: string[],
) {
  return {
    areas: { create: areaIds.map((areaId) => ({ areaId })) },
    members: { create: team },
    relatedFrom: { create: relatedIds.map((toId) => ({ toId })) },
  };
}

export async function saveProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("projects:manage", async (viewer) => {
    const { data, areaIds, team, relatedIds } = await readProject(formData, id);
    const db = getDb();
    try {
      if (!id) {
        const created = await db.$transaction(async (transaction) => {
          const project = await transaction.project.create({
            data: { ...data, ...relations(areaIds, team, relatedIds) },
            select: { id: true },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "project.create",
            entity: "Project",
            entityId: project.id,
            diff: { title: data.title, state: data.state },
          });
          return project;
        });
        createdId = created.id;
      } else {
        const before = await db.project.findUnique({
          where: { id },
          include: {
            areas: { select: { areaId: true } },
            members: {
              orderBy: { sortOrder: "asc" },
              select: { memberId: true, role: true, isLead: true },
            },
            relatedFrom: { select: { toId: true } },
          },
        });
        if (!before)
          throw new AdminActionError("That project no longer exists.");
        const diff = changes(
          {
            ...before,
            areaIds: before.areas.map(({ areaId }) => areaId).sort(),
            team: before.members,
            relatedIds: before.relatedFrom.map(({ toId }) => toId).sort(),
          },
          {
            ...data,
            areaIds: [...areaIds].sort(),
            team: team.map(({ memberId, role, isLead }) => ({
              memberId,
              role,
              isLead,
            })),
            relatedIds: [...relatedIds].sort(),
          },
          ["motivation", "approach", "experiments", "results", "abstract"],
        );
        if (Object.keys(diff).length === 0) {
          return { status: "success", message: "Nothing changed." };
        }
        await db.$transaction(async (transaction) => {
          await transaction.project.update({
            where: { id },
            data: {
              ...data,
              areas: {
                deleteMany: {},
                create: areaIds.map((areaId) => ({ areaId })),
              },
              members: { deleteMany: {}, create: team },
              relatedFrom: {
                deleteMany: {},
                create: relatedIds.map((toId) => ({ toId })),
              },
            },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "project.update",
            entity: "Project",
            entityId: id,
            diff: diff as Prisma.InputJsonValue,
          });
        });
      }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new AdminActionError(
          "Another project already uses that address. Choose a different one.",
        );
      }
      throw error;
    }
    invalidate(cacheTags.projects);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/projects");
  if (createdId) redirect(`/admin/projects/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/projects/${id}`);
  return result;
}

export async function bulkProjectsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("projects:manage", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "Project",
      prefix: "project",
      noun: { one: "project", many: "projects" },
      load: (ids) =>
        getDb().project.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            state: true,
            _count: {
              select: { publications: true, tasks: true, meetings: true },
            },
          },
        }),
      // Tasks and meetings would be deleted with it; publications unlinked.
      keep: (row) =>
        row._count.publications + row._count.tasks + row._count.meetings > 0
          ? "it has publications or team work: archive it instead"
          : null,
      update: (transaction, id, data) =>
        transaction.project.update({ where: { id }, data }),
      remove: (transaction, id) =>
        transaction.project.delete({ where: { id } }),
    });
    invalidate(cacheTags.projects);
    return outcome;
  });
  revalidatePath("/admin/projects");
  return result;
}
