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
  dhakaTime,
  field,
  isUniqueConflict,
  markdownText,
  requiredText,
  runBulk,
} from "@/lib/admin/content-actions";
import { parseNewsCategory } from "@/lib/admin/news";
import { cacheTags } from "@/lib/cache-tags";
import {
  parsePublishState,
  scheduleProblem,
  slugProblem,
} from "@/lib/content-state";
import { getDb } from "@/lib/db";

async function optionalLink(
  model: "member" | "project" | "publication",
  id: string,
  label: string,
): Promise<string | null> {
  if (!id) return null;
  const db = getDb();
  const exists =
    model === "member"
      ? await db.member.count({ where: { id } })
      : model === "project"
        ? await db.project.count({ where: { id } })
        : await db.publication.count({ where: { id } });
  if (!exists) throw new AdminActionError(`That ${label} no longer exists.`);
  return id;
}

function readNews(formData: FormData) {
  const title = requiredText(formData, "title", "a title", 200);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);
  const excerpt = requiredText(formData, "excerpt", "a short summary", 400);
  const body = markdownText(formData, "body", "the article");
  const category = parseNewsCategory(field(formData, "category"));
  if (!category) throw new AdminActionError("Choose a category.");
  const state = parsePublishState(field(formData, "state"));
  if (!state) throw new AdminActionError("Choose a state.");

  let publishAt = dhakaTime(formData, "publishAt", "publish time");
  const scheduleIssue = scheduleProblem(state, publishAt);
  if (scheduleIssue) throw new AdminActionError(scheduleIssue);
  // Published without a time means now, so the page shows its real date.
  if (state === "PUBLISHED" && !publishAt) publishAt = new Date();

  return { title, slug, excerpt, body, category, state, publishAt };
}

export async function saveNewsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("content:manage", async (viewer) => {
    const data = {
      ...readNews(formData),
      authorId: await optionalLink(
        "member",
        field(formData, "authorId"),
        "author",
      ),
      projectId: await optionalLink(
        "project",
        field(formData, "projectId"),
        "project",
      ),
      publicationId: await optionalLink(
        "publication",
        field(formData, "publicationId"),
        "publication",
      ),
    };
    const db = getDb();

    try {
      if (!id) {
        const created = await db.$transaction(async (transaction) => {
          const post = await transaction.newsPost.create({
            data,
            select: { id: true },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "news.create",
            entity: "NewsPost",
            entityId: post.id,
            diff: { title: data.title, state: data.state },
          });
          return post;
        });
        createdId = created.id;
      } else {
        const before = await db.newsPost.findUnique({ where: { id } });
        if (!before) throw new AdminActionError("That post no longer exists.");
        const diff = changes(before, data, ["body"]);
        if (Object.keys(diff).length === 0) {
          return { status: "success", message: "Nothing changed." };
        }
        await db.$transaction(async (transaction) => {
          await transaction.newsPost.update({ where: { id }, data });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "news.update",
            entity: "NewsPost",
            entityId: id,
            diff: diff as Prisma.InputJsonValue,
          });
        });
      }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new AdminActionError(
          "Another news post already uses that address. Choose a different one.",
        );
      }
      throw error;
    }

    invalidate(cacheTags.news);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/news");
  if (createdId) redirect(`/admin/news/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/news/${id}`);
  return result;
}

export async function bulkNewsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("content:manage", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "NewsPost",
      prefix: "news",
      noun: { one: "post", many: "posts" },
      hasPublishAt: true,
      load: (ids) =>
        getDb().newsPost.findMany({
          where: { id: { in: ids } },
          select: { id: true, state: true, publishAt: true },
        }),
      update: (transaction, id, data) =>
        transaction.newsPost.update({ where: { id }, data }),
      remove: (transaction, id) =>
        transaction.newsPost.delete({ where: { id } }),
    });
    invalidate(cacheTags.news);
    return outcome;
  });
  revalidatePath("/admin/news");
  return result;
}
