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
  field,
  isUniqueConflict,
  lines,
  oneOf,
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
  if (createdId) redirect(`/admin/research/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/research/${id}`);
  return result;
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
  if (createdId) redirect(`/admin/research/areas/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/research/areas/${id}`);
  return result;
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
