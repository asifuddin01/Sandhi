"use server";

import { revalidatePath } from "next/cache";

import {
  AdminActionError,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import {
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_TITLE,
  MIN_ANNOUNCEMENT_BODY,
} from "@/lib/announcements";
import { getDb } from "@/lib/db";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refresh(): void {
  revalidatePath("/admin/announcements");
  // Where members read them. Not a public cache tag: an announcement is
  // never part of the published site, so there is nothing public to expire.
  revalidatePath("/news");
  revalidatePath("/portal");
}

export async function postAnnouncementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("content:manage", async (viewer) => {
    const title = field(formData, "title").trim();
    const body = field(formData, "body").trim();
    const pinned = formData.get("pinned") === "on";

    if (title.length < 2 || title.length > MAX_ANNOUNCEMENT_TITLE) {
      throw new AdminActionError("Give it a title people will recognise.");
    }
    if (body.length < MIN_ANNOUNCEMENT_BODY) {
      throw new AdminActionError("Write the announcement first.");
    }
    if (body.length > MAX_ANNOUNCEMENT_BODY) {
      throw new AdminActionError(
        `Keep an announcement within ${MAX_ANNOUNCEMENT_BODY} characters.`,
      );
    }

    await getDb().$transaction(async (transaction) => {
      const announcement = await transaction.announcement.create({
        data: { title, body, pinned, authorId: viewer.member?.id ?? null },
        select: { id: true },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "announcement.post",
        entity: "Announcement",
        entityId: announcement.id,
        diff: { title, pinned },
      });
    });

    return {
      status: "success",
      message: pinned ? "Posted, and pinned to the top." : "Posted.",
    };
  });
  refresh();
  return result;
}

export async function setAnnouncementPinnedAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const result = await runAdminAction("content:manage", async (viewer) => {
    const pinned = field(formData, "pinned") === "yes";
    const announcement = await getDb().announcement.findUnique({
      where: { id },
      select: { title: true, pinned: true },
    });
    if (!announcement) throw new AdminActionError("That is already gone.");
    if (announcement.pinned === pinned) {
      return { status: "success", message: "Nothing changed." };
    }

    await getDb().$transaction(async (transaction) => {
      await transaction.announcement.update({
        where: { id },
        data: { pinned },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "announcement.pin",
        entity: "Announcement",
        entityId: id,
        diff: { pinned: { from: announcement.pinned, to: pinned } },
      });
    });

    return {
      status: "success",
      message: pinned ? "Pinned to the top." : "Unpinned.",
    };
  });
  refresh();
  return result;
}

export async function deleteAnnouncementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const result = await runAdminAction("content:manage", async (viewer) => {
    const announcement = await getDb().announcement.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!announcement) throw new AdminActionError("That is already gone.");

    await getDb().$transaction(async (transaction) => {
      await transaction.announcement.delete({ where: { id } });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "announcement.delete",
        entity: "Announcement",
        entityId: id,
        diff: { title: announcement.title },
      });
    });

    return { status: "success", message: "Taken down." };
  });
  refresh();
  return result;
}
