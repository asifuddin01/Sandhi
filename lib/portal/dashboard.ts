import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  getMemberAnnouncements,
  getMemberProjects,
  workspaceMemberId,
  type MemberAnnouncement,
  type MemberProject,
} from "@/lib/portal-content";
import { getMemberPublications } from "@/lib/portal/publications";

/**
 * Everything the portal's front page shows, for one member.
 *
 * Every query is keyed on the viewer's own member id, never on anything from
 * the request, so this cannot show one person another's work. The front page
 * is a component that renders what this returns; it asks the database for
 * nothing itself.
 */

/** How far ahead the dashboard looks for deadlines. */
export const DUE_SOON_DAYS = 14;

/** The end of the window, from a given moment. Pure, so it can be tested. */
export function dueSoonUntil(now: Date): Date {
  return new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);
}

export interface DueTask {
  id: string;
  title: string;
  dueAt: Date;
  status: string;
  priority: string;
  /** True when the deadline has already passed. */
  overdue: boolean;
  project: { slug: string; title: string } | null;
}

export interface MemberDashboard {
  counts: {
    /** Projects this member is on. */
    projects: number;
    /** Of those, the ones they lead. */
    leading: number;
    /** Tasks assigned to them that are not done. */
    openTasks: number;
    /** Their papers that are drafted or in review, not yet published. */
    publicationsInProgress: number;
  };
  /**
   * Their unfinished tasks due within the next fourteen days, and any already
   * overdue — soonest first, at most eight.
   */
  dueSoon: DueTask[];
  /** The latest few lab announcements, pinned first. */
  announcements: MemberAnnouncement[];
  /** A handful of their projects, for quick links. */
  projects: MemberProject[];
}

export async function getMemberDashboard(
  viewer: Viewer,
  now = new Date(),
): Promise<MemberDashboard | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const db = getDb();
  const [projects, announcements, publications, openTasks, dueRows] =
    await Promise.all([
      getMemberProjects(viewer),
      getMemberAnnouncements(viewer, 3),
      getMemberPublications(viewer),
      db.task.count({
        where: {
          assignees: { some: { memberId } },
          status: { not: "DONE" },
        },
      }),
      db.task.findMany({
        where: {
          assignees: { some: { memberId } },
          status: { not: "DONE" },
          // Overdue ones included on purpose: a deadline that has passed is
          // the one somebody most needs to see.
          dueAt: { not: null, lte: dueSoonUntil(now) },
        },
        orderBy: { dueAt: "asc" },
        take: 8,
        select: {
          id: true,
          title: true,
          dueAt: true,
          status: true,
          priority: true,
          project: { select: { slug: true, title: true } },
        },
      }),
    ]);

  return {
    counts: {
      projects: projects.length,
      leading: projects.filter((project) => project.isLead).length,
      openTasks,
      publicationsInProgress: publications.filter(
        (publication) => publication.stage !== "PUBLISHED",
      ).length,
    },
    dueSoon: dueRows
      .filter((row): row is typeof row & { dueAt: Date } => row.dueAt !== null)
      .map((row) => ({
        ...row,
        overdue: row.dueAt.getTime() < now.getTime(),
      })),
    announcements,
    projects: projects.slice(0, 4),
  };
}

/** Every date the dashboard shows is the lab's day, not the server's. */
export const LAB_TIME_ZONE = "Asia/Dhaka";

/**
 * `hourCycle: "h23"` rather than `hour12: false`: en-GB reads midnight as
 * "24" under the latter, which would wish somebody a good evening at 00:30.
 */
const labHour = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: LAB_TIME_ZONE,
});

export function greeting(now: Date): string {
  const hour = Number(labHour.format(now));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const PREVIEW_LIMIT = 160;

/**
 * An announcement's opening, as text. The body is Markdown, and rendering it
 * on the dashboard would drop a heading or a list into what should be one
 * quiet line — so the marks come out and the words stay words.
 */
export function announcementPreview(body: string): string {
  const text = body
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/[#*_`>~[\]]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return text.length > PREVIEW_LIMIT
    ? `${text.slice(0, PREVIEW_LIMIT).trimEnd()}…`
    : text;
}
