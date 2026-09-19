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
  markdownText,
  oneOf,
  optionalHttpsUrl,
  optionalText,
  requiredText,
  runBulk,
} from "@/lib/admin/content-actions";
import { cacheTags } from "@/lib/cache-tags";
import { slugProblem, unscheduledStates } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { RESOURCE_KINDS } from "@/lib/public-resources";

async function existing(
  model: "project" | "publication",
  id: string,
  label: string,
): Promise<string | null> {
  if (!id) return null;
  const count =
    model === "project"
      ? await getDb().project.count({ where: { id } })
      : await getDb().publication.count({ where: { id } });
  if (!count) throw new AdminActionError(`That ${label} no longer exists.`);
  return id;
}

async function readResource(formData: FormData) {
  const name = requiredText(formData, "title", "a name", 200);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);
  const changelogText = field(formData, "changelog");
  if (changelogText.length > 20_000) {
    throw new AdminActionError("The changelog is too long to save.");
  }

  const areaIds = [
    ...new Set(
      formData
        .getAll("areaIds")
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const known = await getDb().researchArea.count({
    where: { id: { in: areaIds } },
  });
  if (known !== areaIds.length) {
    throw new AdminActionError("One of the research areas no longer exists.");
  }

  return {
    data: {
      name,
      slug,
      kind: oneOf(field(formData, "kind"), RESOURCE_KINDS, "Choose a kind."),
      description: markdownText(
        formData,
        "description",
        "the description",
        20_000,
      ),
      license: optionalText(formData, "license", "the licence", 120),
      version: optionalText(formData, "version", "the version", 60),
      downloadUrl: optionalHttpsUrl(
        formData,
        "downloadUrl",
        "The download link",
      ),
      repoUrl: optionalHttpsUrl(formData, "repoUrl", "The repository link"),
      docsUrl: optionalHttpsUrl(formData, "docsUrl", "The documentation link"),
      hfUrl: optionalHttpsUrl(formData, "hfUrl", "The Hugging Face link"),
      bibtex: optionalText(formData, "bibtex", "the BibTeX entry", 10_000),
      changelog: changelogText.trim() ? changelogText : null,
      projectId: await existing(
        "project",
        field(formData, "projectId"),
        "project",
      ),
      publicationId: await existing(
        "publication",
        field(formData, "publicationId"),
        "publication",
      ),
      state: oneOf(
        field(formData, "state"),
        unscheduledStates,
        "Choose a state.",
      ),
    },
    areaIds,
  };
}

export async function saveResourceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("content:manage", async (viewer) => {
    const { data, areaIds } = await readResource(formData);
    const db = getDb();
    try {
      if (!id) {
        const created = await db.$transaction(async (transaction) => {
          const resource = await transaction.resource.create({
            data: {
              ...data,
              areas: { create: areaIds.map((areaId) => ({ areaId })) },
            },
            select: { id: true },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "resource.create",
            entity: "Resource",
            entityId: resource.id,
            diff: { name: data.name, state: data.state },
          });
          return resource;
        });
        createdId = created.id;
      } else {
        const before = await db.resource.findUnique({
          where: { id },
          include: { areas: { select: { areaId: true } } },
        });
        if (!before) {
          throw new AdminActionError("That resource no longer exists.");
        }
        const beforeAreas = before.areas.map(({ areaId }) => areaId).sort();
        const diff = changes(
          { ...before, areaIds: beforeAreas },
          { ...data, areaIds: [...areaIds].sort() },
          ["description", "changelog", "bibtex"],
        );
        if (Object.keys(diff).length === 0) {
          return { status: "success", message: "Nothing changed." };
        }
        await db.$transaction(async (transaction) => {
          await transaction.resource.update({
            where: { id },
            data: {
              ...data,
              areas: {
                deleteMany: {},
                create: areaIds.map((areaId) => ({ areaId })),
              },
            },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "resource.update",
            entity: "Resource",
            entityId: id,
            diff: diff as Prisma.InputJsonValue,
          });
        });
      }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new AdminActionError(
          "Another resource already uses that address. Choose a different one.",
        );
      }
      throw error;
    }
    invalidate(cacheTags.resources);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/resources");
  if (createdId) redirect(`/admin/resources/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/resources/${id}`);
  return result;
}

export async function bulkResourcesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("content:manage", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "Resource",
      prefix: "resource",
      noun: { one: "resource", many: "resources" },
      load: (ids) =>
        getDb().resource.findMany({
          where: { id: { in: ids } },
          select: { id: true, state: true },
        }),
      update: (transaction, id, data) =>
        transaction.resource.update({ where: { id }, data }),
      remove: (transaction, id) =>
        transaction.resource.delete({ where: { id } }),
    });
    invalidate(cacheTags.resources);
    return outcome;
  });
  revalidatePath("/admin/resources");
  return result;
}
