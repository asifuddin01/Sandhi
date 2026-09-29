"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Viewer } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { fromDhakaInput } from "@/lib/dhaka-time";
import {
  MAX_MEETING_LINK,
  MAX_MEETING_TEXT,
  MAX_MEETING_TITLE,
} from "@/lib/portal/meeting-limits";
import { mayEditMeeting } from "@/lib/portal/meetings";
import { leadsProject } from "@/lib/portal/progress";

import {
  field,
  ProgressError,
  run,
  type ProgressState,
} from "../projects/action-runtime";

/**
 * Calling a meeting, writing up what happened in it, and calling it off.
 *
 * Who may do any of it is `mayEditMeeting`, and this asks it the same
 * question the list page asks — there is no second rule here to drift from
 * the one the page shows its buttons by.
 */

async function refuseUnlessAllowed(viewer: Viewer, projectId: string | null) {
  const led =
    projectId && (await leadsProject(viewer, projectId)) ? [projectId] : [];
  if (mayEditMeeting(viewer, projectId, led)) return;
  throw new ProgressError(
    projectId
      ? "Only the research lead, an assistant lead, or an administrator can call a meeting for a project."
      : "Only an administrator can call a meeting for the whole lab.",
  );
}

/** "" means the whole lab; anything else has to be a real project. */
async function readProjectId(formData: FormData): Promise<string | null> {
  const value = field(formData, "projectId").trim();
  if (!value) return null;
  const project = await getDb().project.findUnique({
    where: { id: value },
    select: { id: true },
  });
  if (!project) throw new ProgressError("That project does not exist.");
  return project.id;
}

/**
 * Who is expected. Everyone named has to be on the project, and a lab-wide
 * meeting names nobody: it is for everyone, and a list would only say who
 * was remembered.
 */
async function readAttendees(
  formData: FormData,
  projectId: string | null,
): Promise<string[]> {
  if (!projectId) return [];
  const asked = [
    ...new Set(
      formData
        .getAll("attendeeId")
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
    throw new ProgressError("Expect only people on this project.");
  }
  return onTeam.map((person) => person.memberId);
}

/** A meeting link is a place to join, so it has to be a real https address. */
function readLink(formData: FormData): string | null {
  const value = field(formData, "link").trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProgressError("The joining link needs a full https:// address.");
  }
  if (url.protocol !== "https:" || value.length > MAX_MEETING_LINK) {
    throw new ProgressError("The joining link needs a full https:// address.");
  }
  return url.toString();
}

function readText(formData: FormData, name: string, label: string) {
  const value = field(formData, name).trim();
  if (value.length > MAX_MEETING_TEXT) {
    throw new ProgressError(`Keep the ${label} shorter.`);
  }
  return value || null;
}

function readTimes(formData: FormData) {
  const startsAt = fromDhakaInput(field(formData, "startsAt").trim());
  if (!startsAt) throw new ProgressError("Say when the meeting starts.");

  const endValue = field(formData, "endsAt").trim();
  const endsAt = endValue ? fromDhakaInput(endValue) : null;
  if (endValue && !endsAt) throw new ProgressError("That end is not a time.");
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new ProgressError("A meeting has to end after it starts.");
  }
  return { startsAt, endsAt };
}

function readTitle(formData: FormData): string {
  const title = field(formData, "title").trim();
  if (!title) throw new ProgressError("Say what the meeting is.");
  if (title.length > MAX_MEETING_TITLE) {
    throw new ProgressError("That title is too long.");
  }
  return title;
}

/** The meeting, and the project it is about, for the checks that follow. */
async function meetingProjectId(id: string): Promise<string | null | false> {
  const meeting = await getDb().meeting.findUnique({
    where: { id },
    select: { projectId: true },
  });
  return meeting ? meeting.projectId : false;
}

export async function createMeetingAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const result = await run(async (viewer) => {
    const projectId = await readProjectId(formData);
    await refuseUnlessAllowed(viewer, projectId);

    const { startsAt, endsAt } = readTimes(formData);
    await getDb().meeting.create({
      data: {
        title: readTitle(formData),
        startsAt,
        endsAt,
        link: readLink(formData),
        agenda: readText(formData, "agenda", "agenda"),
        projectId,
        attendeeIds: await readAttendees(formData, projectId),
      },
    });
    return { status: "success", message: "Meeting called." };
  });

  revalidatePath("/portal/meetings");
  return result;
}

export async function updateMeetingAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "meetingId");

  const result = await run(async (viewer) => {
    const projectId = await meetingProjectId(id);
    if (projectId === false) throw new ProgressError("That meeting is gone.");
    await refuseUnlessAllowed(viewer, projectId);

    const { startsAt, endsAt } = readTimes(formData);
    await getDb().meeting.update({
      where: { id },
      data: {
        title: readTitle(formData),
        startsAt,
        endsAt,
        link: readLink(formData),
        agenda: readText(formData, "agenda", "agenda"),
        notes: readText(formData, "notes", "notes"),
        attendeeIds: await readAttendees(formData, projectId),
      },
    });
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/portal/meetings");
  revalidatePath(`/portal/meetings/${id}`);
  return result;
}

export async function deleteMeetingAction(
  _previous: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const id = field(formData, "meetingId");

  const result = await run(async (viewer) => {
    const projectId = await meetingProjectId(id);
    if (projectId === false) throw new ProgressError("That meeting is gone.");
    await refuseUnlessAllowed(viewer, projectId);

    await getDb().meeting.delete({ where: { id } });
    return { status: "success", message: "Called off." };
  });

  revalidatePath("/portal/meetings");
  // The page this was pressed on is about a meeting that no longer exists,
  // so staying put means a 404 where a confirmation should be. The redirect
  // goes outside `run`, which swallows every error it does not recognise —
  // and `redirect` works by throwing one.
  if (result.status === "success") redirect("/portal/meetings");
  return result;
}
