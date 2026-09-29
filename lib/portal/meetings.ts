import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { can } from "@/lib/permissions";
import { workspaceMemberId } from "@/lib/portal-content";

export {
  MAX_MEETING_LINK,
  MAX_MEETING_TEXT,
  MAX_MEETING_TITLE,
} from "@/lib/portal/meeting-limits";

/**
 * Meetings, as the people in them see them.
 *
 * A meeting belongs either to a project — in which case the project's team
 * sees it — or to the lab, which everyone with a member record sees. The
 * attendee list says who is expected, not who is allowed to look: a lab this
 * size keeps no secrets from its own teams, and a meeting nobody can find is
 * a meeting nobody attends.
 */

/** How far back the record goes before it is only worth the archive. */
export const PAST_WINDOW_DAYS = 180;
export const MEETINGS_LIMIT = 100;

export interface MemberMeeting {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  link: string | null;
  agenda: string | null;
  notes: string | null;
  project: { slug: string; title: string } | null;
  attendees: Array<{ id: string; name: string }>;
  /** The viewer is named on the attendee list. */
  expected: boolean;
  /** The viewer may change or delete it. */
  editable: boolean;
}

export interface MemberMeetings {
  upcoming: MemberMeeting[];
  past: MemberMeeting[];
  /** Projects the viewer may call a meeting for; empty means they may not. */
  canCallFor: Array<{ id: string; title: string }>;
  /** Whether the viewer may call a meeting for the whole lab. */
  canCallLabWide: boolean;
}

/**
 * Who may change a meeting: whoever runs the work it is about. For a
 * project that is its lead or assistant lead, and an administrator organises
 * across the lab, so they may too. A lab-wide meeting is an administrator's.
 */
export function mayEditMeeting(
  viewer: Viewer,
  projectId: string | null,
  ledProjectIds: readonly string[],
): boolean {
  if (can(viewer.role, "projects:manage")) return true;
  if (!projectId) return false;
  return ledProjectIds.includes(projectId);
}

/** A meeting that has not finished yet still counts as upcoming. */
export function hasFinished(meeting: MemberMeeting, now: Date): boolean {
  return (meeting.endsAt ?? meeting.startsAt).getTime() < now.getTime();
}

export async function getMemberMeetings(
  viewer: Viewer,
  now = new Date(),
): Promise<MemberMeetings | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const db = getDb();
  const memberships = await db.projectMember.findMany({
    where: { memberId },
    select: {
      projectId: true,
      isLead: true,
      isAssistantLead: true,
      project: { select: { title: true } },
    },
  });
  const projectIds = memberships.map((row) => row.projectId);
  const ledProjectIds = memberships
    .filter((row) => row.isLead || row.isAssistantLead)
    .map((row) => row.projectId);

  const since = new Date(
    now.getTime() - PAST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const rows = await db.meeting.findMany({
    where: {
      startsAt: { gte: since },
      // Theirs, or the lab's. Nothing from a project they are not on.
      OR: [{ projectId: null }, { projectId: { in: projectIds } }],
    },
    orderBy: { startsAt: "asc" },
    take: MEETINGS_LIMIT,
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      link: true,
      agenda: true,
      notes: true,
      attendeeIds: true,
      projectId: true,
      project: { select: { slug: true, title: true } },
    },
  });

  // One lookup for every attendee named across every meeting, rather than
  // one per meeting.
  const namedIds = [...new Set(rows.flatMap((row) => row.attendeeIds))];
  const people = namedIds.length
    ? await db.member.findMany({
        where: { id: { in: namedIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(people.map((person) => [person.id, person.name]));

  const meetings: MemberMeeting[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    link: row.link,
    agenda: row.agenda,
    notes: row.notes,
    project: row.project,
    attendees: row.attendeeIds.map((id) => ({
      id,
      name: nameOf.get(id) ?? "Someone who has left",
    })),
    expected: row.attendeeIds.includes(memberId),
    editable: mayEditMeeting(viewer, row.projectId, ledProjectIds),
  }));

  return {
    upcoming: meetings.filter((meeting) => !hasFinished(meeting, now)),
    // The most recent first: a record is read backwards from now.
    past: meetings.filter((meeting) => hasFinished(meeting, now)).reverse(),
    canCallFor: memberships
      .filter((row) => ledProjectIds.includes(row.projectId))
      .map((row) => ({ id: row.projectId, title: row.project.title })),
    canCallLabWide: can(viewer.role, "projects:manage"),
  };
}

export async function getMemberMeeting(
  viewer: Viewer,
  id: string,
  now = new Date(),
): Promise<MemberMeeting | null> {
  const all = await getMemberMeetings(viewer, now);
  if (!all) return null;
  return (
    [...all.upcoming, ...all.past].find((meeting) => meeting.id === id) ?? null
  );
}
