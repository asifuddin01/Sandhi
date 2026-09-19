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
  dhakaTime,
  field,
  isUniqueConflict,
  lines,
  markdownText,
  oneOf,
  optionalHttpsUrl,
  optionalText,
  requiredText,
  runBulk,
} from "@/lib/admin/content-actions";
import { EVENT_KINDS } from "@/lib/admin/events";
import { cacheTags } from "@/lib/cache-tags";
import { slugProblem, unscheduledStates } from "@/lib/content-state";
import { getDb } from "@/lib/db";

function readEvent(formData: FormData) {
  const title = requiredText(formData, "title", "a title", 200);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);
  const startsAt = dhakaTime(formData, "startsAt", "a start time", {
    required: true,
  })!;
  const endsAt = dhakaTime(formData, "endsAt", "end time");
  if (endsAt && endsAt <= startsAt) {
    throw new AdminActionError("The event must end after it starts.");
  }
  return {
    title,
    slug,
    kind: oneOf(
      field(formData, "kind"),
      EVENT_KINDS,
      "Choose a kind of event.",
    ),
    abstract: markdownText(formData, "abstract", "the description", 20_000),
    speakers: lines(formData, "speakers", "speakers", { maxLength: 160 }),
    startsAt,
    endsAt,
    location: optionalText(formData, "location", "the location", 200),
    isOnline: checkbox(formData, "isOnline"),
    registerUrl: optionalHttpsUrl(
      formData,
      "registerUrl",
      "The registration link",
    ),
    allowRegistration: checkbox(formData, "allowRegistration"),
    recordingUrl: optionalHttpsUrl(
      formData,
      "recordingUrl",
      "The recording link",
    ),
    slidesUrl: optionalHttpsUrl(formData, "slidesUrl", "The slides link"),
    state: oneOf(
      field(formData, "state"),
      unscheduledStates,
      "Choose a state.",
    ),
  };
}

export async function saveEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("content:manage", async (viewer) => {
    const data = readEvent(formData);
    const db = getDb();
    try {
      if (!id) {
        const created = await db.$transaction(async (transaction) => {
          const event = await transaction.event.create({
            data,
            select: { id: true },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "event.create",
            entity: "Event",
            entityId: event.id,
            diff: { title: data.title, state: data.state },
          });
          return event;
        });
        createdId = created.id;
      } else {
        const before = await db.event.findUnique({ where: { id } });
        if (!before) throw new AdminActionError("That event no longer exists.");
        const diff = changes(before, data, ["abstract"]);
        if (Object.keys(diff).length === 0) {
          return { status: "success", message: "Nothing changed." };
        }
        await db.$transaction(async (transaction) => {
          await transaction.event.update({ where: { id }, data });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "event.update",
            entity: "Event",
            entityId: id,
            diff: diff as Prisma.InputJsonValue,
          });
        });
      }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new AdminActionError(
          "Another event already uses that address. Choose a different one.",
        );
      }
      throw error;
    }
    invalidate(cacheTags.events);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/events");
  if (createdId) redirect(`/admin/events/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/events/${id}`);
  return result;
}

export async function bulkEventsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("content:manage", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "Event",
      prefix: "event",
      noun: { one: "event", many: "events" },
      load: (ids) =>
        getDb().event.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            state: true,
            _count: { select: { registrations: true } },
          },
        }),
      // Deleting would take people's registrations with it.
      keep: (row) =>
        row._count.registrations > 0
          ? "people have registered: archive it instead"
          : null,
      update: (transaction, id, data) =>
        transaction.event.update({ where: { id }, data }),
      remove: (transaction, id) => transaction.event.delete({ where: { id } }),
    });
    invalidate(cacheTags.events);
    return outcome;
  });
  revalidatePath("/admin/events");
  return result;
}
