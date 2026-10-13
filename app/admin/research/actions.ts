"use server";

import { revalidatePath } from "next/cache";

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
  field,
  followOnPage,
  isUniqueConflict,
  lines,
  oneOf,
  openCreated,
  requiredText,
  runBulk,
} from "@/lib/admin/content-actions";
import { cacheTags } from "@/lib/cache-tags";
import { slugProblem, unscheduledStates } from "@/lib/content-state";
import { getDb } from "@/lib/db";

function common(formData: FormData) {
  const name = requiredText(formData, "title", "a name", 200);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);
  const overview = field(formData, "overview");
  if (overview.length > 50_000) {
    throw new AdminActionError("The overview is too long to save.");
  }
  const sortOrder = Number(field(formData, "sortOrder") || "0");
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
    throw new AdminActionError(
      "Use a whole number from 0 to 999 for the order.",
    );
  }
  return {
    name,
    slug,
    overview: overview.trim() ? overview : null,
    sortOrder,
    state: oneOf(
      field(formData, "state"),
      unscheduledStates,
      "Choose a state.",
    ),
  };
}

function conflict(error: unknown, noun: string): never {
  if (isUniqueConflict(error)) {
    throw new AdminActionError(
      `Another ${noun} already uses that address. Choose a different one.`,
    );
  }
  throw error;
}

export async function saveThemeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("research:manage", async (viewer) => {
    const data = {
      ...common(formData),
      gloss: requiredText(formData, "gloss", "a short description", 300),
    };
    const db = getDb();
    try {
      if (!id) {
        const created = await db.$transaction(async (transaction) => {
          const theme = await transaction.researchTheme.create({
            data,
            select: { id: true },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "theme.create",
            entity: "ResearchTheme",
            entityId: theme.id,
            diff: { name: data.name, state: data.state },
          });
          return theme;
        });
        createdId = created.id;
      } else {
        const before = await db.researchTheme.findUnique({ where: { id } });
        if (!before) throw new AdminActionError("That theme no longer exists.");
        const diff = changes(before, data, ["overview"]);
        if (Object.keys(diff).length === 0) {
          return { status: "success", message: "Nothing changed." };
        }
        await db.$transaction(async (transaction) => {
          await transaction.researchTheme.update({ where: { id }, data });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "theme.update",
            entity: "ResearchTheme",
            entityId: id,
            diff: diff as Prisma.InputJsonValue,
          });
        });
      }
    } catch (error) {
      conflict(error, "theme");
    }
    invalidate(cacheTags.research);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/research");
  if (createdId)
    openCreated(formData, `/admin/research/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/research/${id}`);
  return followOnPage(formData, result, "/research");
}

export async function saveAreaAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("research:manage", async (viewer) => {
    const themeId = field(formData, "themeId");
    const db = getDb();
    if (
      !themeId ||
      !(await db.researchTheme.count({ where: { id: themeId } }))
    ) {
      throw new AdminActionError("Choose the theme this area belongs to.");
    }
    const data = {
      ...common(formData),
      summary: requiredText(formData, "summary", "a summary", 500),
      questions: lines(formData, "questions", "open questions"),
      themeId,
    };
    try {
      if (!id) {
        const created = await db.$transaction(async (transaction) => {
          const area = await transaction.researchArea.create({
            data,
            select: { id: true },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "area.create",
            entity: "ResearchArea",
            entityId: area.id,
            diff: { name: data.name, state: data.state },
          });
          return area;
        });
        createdId = created.id;
      } else {
        const before = await db.researchArea.findUnique({ where: { id } });
        if (!before) throw new AdminActionError("That area no longer exists.");
        const diff = changes(before, data, ["overview"]);
        if (Object.keys(diff).length === 0) {
          return { status: "success", message: "Nothing changed." };
        }
        await db.$transaction(async (transaction) => {
          await transaction.researchArea.update({ where: { id }, data });
          // Opportunities name areas by address; follow a renamed one.
          if (before.slug !== data.slug) {
            const affected = await transaction.opportunity.findMany({
              where: { areaSlugs: { has: before.slug } },
              select: { id: true, areaSlugs: true },
            });
            for (const opportunity of affected) {
              await transaction.opportunity.update({
                where: { id: opportunity.id },
                data: {
                  areaSlugs: opportunity.areaSlugs.map((slug) =>
                    slug === before.slug ? data.slug : slug,
                  ),
                },
              });
            }
          }
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "area.update",
            entity: "ResearchArea",
            entityId: id,
            diff: diff as Prisma.InputJsonValue,
          });
        });
      }
    } catch (error) {
      conflict(error, "research area");
    }
    invalidate(cacheTags.research, cacheTags.opportunities);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/research/areas");
  if (createdId)
    openCreated(formData, `/admin/research/areas/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/research/areas/${id}`);
  return followOnPage(formData, result, "/research", "/research/areas/");
}

export async function bulkThemesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("research:manage", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "ResearchTheme",
      prefix: "theme",
      noun: { one: "theme", many: "themes" },
      load: (ids) =>
        getDb().researchTheme.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            state: true,
            _count: { select: { areas: true } },
          },
        }),
      keep: (row) =>
        row._count.areas > 0 ? "it still has research areas" : null,
      update: (transaction, id, data) =>
        transaction.researchTheme.update({ where: { id }, data }),
      remove: (transaction, id) =>
        transaction.researchTheme.delete({ where: { id } }),
    });
    invalidate(cacheTags.research);
    return outcome;
  });
  revalidatePath("/admin/research");
  return result;
}

export async function bulkAreasAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("research:manage", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "ResearchArea",
      prefix: "area",
      noun: { one: "area", many: "areas" },
      load: (ids) =>
        getDb().researchArea.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            state: true,
            _count: {
              select: {
                projects: true,
                publications: true,
                members: true,
                resources: true,
              },
            },
          },
        }),
      // Deleting would silently drop these links.
      keep: (row) =>
        Object.values(row._count).some((count) => count > 0)
          ? "it is linked to projects, publications, people, or resources"
          : null,
      update: (transaction, id, data) =>
        transaction.researchArea.update({ where: { id }, data }),
      remove: (transaction, id) =>
        transaction.researchArea.delete({ where: { id } }),
    });
    invalidate(cacheTags.research);
    return outcome;
  });
  revalidatePath("/admin/research/areas");
  return result;
}

/**
 * One part of a theme or an area, saved from its own section of the public
 * page. What a theme or an area is called, and where it sits, is not changed
 * from there; that is `saveThemeAction` and `saveAreaAction`.
 */
export async function saveResearchPartAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const onTheme = field(formData, "kind") === "theme";
  const part = field(formData, "part");

  return runAdminAction("research:manage", async (viewer) => {
    const db = getDb();
    const before = onTheme
      ? await db.researchTheme.findUnique({ where: { id } })
      : await db.researchArea.findUnique({ where: { id } });
    if (!before) throw new AdminActionError("That page no longer exists.");

    let data: { overview: string | null } | { questions: string[] };
    if (part === "overview") {
      const overview = field(formData, "overview");
      if (overview.length > 50_000) {
        throw new AdminActionError("The overview is too long to save.");
      }
      data = { overview: overview.trim() ? overview : null };
    } else if (part === "questions" && !onTheme) {
      data = { questions: lines(formData, "questions", "open questions") };
    } else {
      throw new AdminActionError("There is nothing here to save.");
    }

    const diff = changes(before, data, ["overview"]);
    if (Object.keys(diff).length === 0) {
      return { status: "success", message: "Nothing changed." };
    }
    await db.$transaction(async (transaction) => {
      if (onTheme) {
        await transaction.researchTheme.update({ where: { id }, data });
      } else {
        await transaction.researchArea.update({ where: { id }, data });
      }
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: onTheme ? "theme.update" : "area.update",
        entity: onTheme ? "ResearchTheme" : "ResearchArea",
        entityId: id,
        diff: diff as Prisma.InputJsonValue,
      });
    });
    invalidate(cacheTags.research);
    return { status: "success", message: "Saved." };
  });
}

/**
 * What can be placed in a research area from the area's own page, and who
 * may: the capability each kind's own editor asks for.
 */
const placeable = {
  project: {
    capability: "projects:manage",
    tag: cacheTags.projects,
    entity: "Project",
    title: async (id: string) =>
      (
        await getDb().project.findUnique({
          where: { id },
          select: { title: true },
        })
      )?.title,
    add: (transaction: Prisma.TransactionClient, id: string, areaId: string) =>
      transaction.projectArea.upsert({
        where: { projectId_areaId: { projectId: id, areaId } },
        update: {},
        create: { projectId: id, areaId },
      }),
    remove: (
      transaction: Prisma.TransactionClient,
      id: string,
      areaId: string,
    ) =>
      transaction.projectArea.deleteMany({
        where: { projectId: id, areaId },
      }),
  },
  publication: {
    capability: "publications:publish",
    tag: cacheTags.publications,
    entity: "Publication",
    title: async (id: string) =>
      (
        await getDb().publication.findUnique({
          where: { id },
          select: { title: true },
        })
      )?.title,
    add: (transaction: Prisma.TransactionClient, id: string, areaId: string) =>
      transaction.publicationArea.upsert({
        where: { publicationId_areaId: { publicationId: id, areaId } },
        update: {},
        create: { publicationId: id, areaId },
      }),
    remove: (
      transaction: Prisma.TransactionClient,
      id: string,
      areaId: string,
    ) =>
      transaction.publicationArea.deleteMany({
        where: { publicationId: id, areaId },
      }),
  },
  resource: {
    capability: "content:manage",
    tag: cacheTags.resources,
    entity: "Resource",
    title: async (id: string) =>
      (
        await getDb().resource.findUnique({
          where: { id },
          select: { name: true },
        })
      )?.name,
    add: (transaction: Prisma.TransactionClient, id: string, areaId: string) =>
      transaction.resourceArea.upsert({
        where: { resourceId_areaId: { resourceId: id, areaId } },
        update: {},
        create: { resourceId: id, areaId },
      }),
    remove: (
      transaction: Prisma.TransactionClient,
      id: string,
      areaId: string,
    ) =>
      transaction.resourceArea.deleteMany({
        where: { resourceId: id, areaId },
      }),
  },
} as const;

/** Puts an existing project, publication or resource in an area, or takes it out. */
export async function placeInAreaAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const kind = field(formData, "kind");
  if (!(kind in placeable)) {
    return { status: "error", message: "Choose what to add." };
  }
  const place = placeable[kind as keyof typeof placeable];
  const id = field(formData, "recordId");
  const areaId = field(formData, "areaId");
  const remove = field(formData, "remove") === "yes";

  return runAdminAction(place.capability, async (viewer) => {
    const [title, area] = await Promise.all([
      place.title(id),
      getDb().researchArea.findUnique({
        where: { id: areaId },
        select: { name: true },
      }),
    ]);
    if (!title) throw new AdminActionError("Choose one from the list.");
    if (!area) throw new AdminActionError("That area no longer exists.");

    await getDb().$transaction(async (transaction) => {
      await (remove ? place.remove : place.add)(transaction, id, areaId);
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: `${kind}.${remove ? "area_removed" : "area_assigned"}`,
        entity: place.entity,
        entityId: id,
        diff: { area: area.name },
      });
    });
    invalidate(cacheTags.research, place.tag);
    return {
      status: "success",
      message: remove
        ? `“${title}” is out of ${area.name}.`
        : `“${title}” is in ${area.name}.`,
    };
  });
}
