"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import {
  AdminActionError,
  invalidate,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import { parseNewsCategory } from "@/lib/admin/news";
import { cacheTags } from "@/lib/cache-tags";
import {
  deletable,
  parseBulkAction,
  parsePublishState,
  scheduleProblem,
  slugProblem,
  type PublishStateValue,
} from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { fromDhakaInput } from "@/lib/dhaka-time";

const MAX_BODY_LENGTH = 100_000;
const MAX_BULK = 100;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function required(
  formData: FormData,
  name: string,
  label: string,
  max: number,
): string {
  const value = field(formData, name).trim();
  if (!value) throw new AdminActionError(`Enter ${label}.`);
  if (value.length > max) {
    throw new AdminActionError(`Keep ${label} under ${max} characters.`);
  }
  return value;
}

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
  const title = required(formData, "title", "a title", 200);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);
  const excerpt = required(formData, "excerpt", "a short summary", 400);
  const body = field(formData, "body");
  if (!body.trim()) throw new AdminActionError("Write the article.");
  if (body.length > MAX_BODY_LENGTH) {
    throw new AdminActionError("The article is too long to save.");
  }
  const category = parseNewsCategory(field(formData, "category"));
  if (!category) throw new AdminActionError("Choose a category.");
  const state = parsePublishState(field(formData, "state"));
  if (!state) throw new AdminActionError("Choose a state.");

  const publishAtText = field(formData, "publishAt").trim();
  let publishAt = publishAtText ? fromDhakaInput(publishAtText) : null;
  if (publishAtText && !publishAt) {
    throw new AdminActionError("Enter a valid publish time.");
  }
  const scheduleIssue = scheduleProblem(state, publishAt);
  if (scheduleIssue) throw new AdminActionError(scheduleIssue);
  // Published without a time means now, so the page shows its real date.
  if (state === "PUBLISHED" && !publishAt) publishAt = new Date();

  return { title, slug, excerpt, body, category, state, publishAt };
}

function isSlugConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function changes(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    const previous = before[key];
    const same =
      previous instanceof Date && value instanceof Date
        ? previous.getTime() === value.getTime()
        : previous === value;
    // Long text is recorded as changed, not copied into the log.
    if (!same) {
      diff[key] =
        key === "body"
          ? { from: "(previous text)", to: "(new text)" }
          : { from: previous ?? null, to: value ?? null };
    }
  }
  return diff;
}

export async function saveNewsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("content:manage", async (viewer) => {
    const values = readNews(formData);
    const links = {
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
    const data = { ...values, ...links };
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
            diff: { title: values.title, state: values.state },
          });
          return post;
        });
        createdId = created.id;
      } else {
        const before = await db.newsPost.findUnique({ where: { id } });
        if (!before) throw new AdminActionError("That post no longer exists.");
        const diff = changes(before, data);
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
      if (isSlugConflict(error)) {
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

const bulkStates: Record<string, PublishStateValue> = {
  publish: "PUBLISHED",
  draft: "DRAFT",
  archive: "ARCHIVED",
};

export async function bulkNewsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("content:manage", async (viewer) => {
    const action = parseBulkAction(field(formData, "bulkAction"));
    if (!action) throw new AdminActionError("Choose what to do.");
    const ids = [
      ...new Set(
        formData
          .getAll("ids")
          .filter((id): id is string => typeof id === "string"),
      ),
    ].slice(0, MAX_BULK);
    if (ids.length === 0)
      throw new AdminActionError("Select at least one post.");

    const db = getDb();
    const posts = await db.newsPost.findMany({
      where: { id: { in: ids } },
      select: { id: true, state: true, publishAt: true },
    });
    const now = new Date();
    let changed = 0;
    let skipped = 0;

    await db.$transaction(async (transaction) => {
      for (const post of posts) {
        const state = post.state as PublishStateValue;
        if (action === "delete") {
          if (!deletable(state)) {
            skipped += 1;
            continue;
          }
          await transaction.newsPost.delete({ where: { id: post.id } });
        } else {
          const nextState = bulkStates[action]!;
          const publishAt =
            action === "publish" && (!post.publishAt || post.publishAt > now)
              ? now
              : post.publishAt;
          if (state === nextState && publishAt === post.publishAt) continue;
          await transaction.newsPost.update({
            where: { id: post.id },
            data: { state: nextState, publishAt },
          });
        }
        changed += 1;
        await recordAudit(transaction, {
          actorId: viewer.userId,
          action: `news.${action}`,
          entity: "NewsPost",
          entityId: post.id,
          diff: {
            state: {
              from: state,
              to: action === "delete" ? null : bulkStates[action],
            },
          },
        });
      }
    });

    invalidate(cacheTags.news);
    const done =
      action === "delete"
        ? `${changed} deleted`
        : action === "publish"
          ? `${changed} published`
          : action === "archive"
            ? `${changed} archived`
            : `${changed} moved to draft`;
    return {
      status: "success",
      message:
        skipped > 0
          ? `${done}. ${skipped} published or in review ${skipped === 1 ? "was" : "were"} kept: archive them first.`
          : `${done}.`,
    };
  });
  revalidatePath("/admin/news");
  return result;
}
