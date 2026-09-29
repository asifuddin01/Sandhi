import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";
import { dueSoonUntil } from "@/lib/portal/dashboard";
import { TASK_PRIORITIES } from "@/lib/portal/progress-limits";

/**
 * Everything assigned to one member, across every project they are on.
 *
 * The project workspace shows a project's whole board; this shows one
 * person's work and nobody else's. Every query is keyed on the viewer's own
 * member id, so it cannot widen into someone else's list.
 */

/** How long a finished task stays on the page. */
export const DONE_WINDOW_DAYS = 14;

/** A safety valve, not a feature: nobody has this many open tasks. */
export const TASKS_LIMIT = 200;

export interface MemberTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: Date | null;
  project: { slug: string; title: string } | null;
}

export type TaskGroupKey = "overdue" | "soon" | "later" | "undated" | "done";

export interface TaskGroup {
  key: TaskGroupKey;
  heading: string;
  /** Said under the heading when the group is worth explaining. */
  note: string | null;
  tasks: MemberTask[];
}

const HEADINGS: Record<TaskGroupKey, { heading: string; note: string | null }> =
  {
    overdue: { heading: "Overdue", note: "The date has passed." },
    soon: { heading: "Due in the next two weeks", note: null },
    later: { heading: "Later", note: null },
    undated: { heading: "No date", note: null },
    done: {
      heading: "Finished recently",
      note: "Marked done in the last fortnight. Put one back if it was early.",
    },
  };

/** Urgent before low, when nothing else separates two tasks. */
function byPriority(task: MemberTask): number {
  const rank = (TASK_PRIORITIES as readonly string[]).indexOf(task.priority);
  return rank === -1 ? 0 : rank;
}

/**
 * Splits one member's tasks into the groups the page shows. Pure, so the
 * boundaries can be tested without a database: a task due at this instant is
 * not yet overdue, and one due exactly a fortnight out is still "soon".
 */
export function groupTasks(tasks: MemberTask[], now: Date): TaskGroup[] {
  const horizon = dueSoonUntil(now).getTime();
  const moment = now.getTime();
  const of: Record<TaskGroupKey, MemberTask[]> = {
    overdue: [],
    soon: [],
    later: [],
    undated: [],
    done: [],
  };

  for (const task of tasks) {
    if (task.status === "DONE") of.done.push(task);
    else if (!task.dueAt) of.undated.push(task);
    else if (task.dueAt.getTime() < moment) of.overdue.push(task);
    else if (task.dueAt.getTime() <= horizon) of.soon.push(task);
    else of.later.push(task);
  }

  // Dated groups run soonest first; the undated ones have only their
  // priority to sort them by.
  for (const key of ["overdue", "soon", "later", "done"] as const) {
    of[key].sort(
      (a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0),
    );
  }
  of.undated.sort(
    (a, b) => byPriority(b) - byPriority(a) || a.title.localeCompare(b.title),
  );

  return (Object.keys(of) as TaskGroupKey[]).map((key) => ({
    key,
    ...HEADINGS[key],
    tasks: of[key],
  }));
}

export async function getMemberTasks(
  viewer: Viewer,
  now = new Date(),
): Promise<TaskGroup[] | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const doneSince = new Date(
    now.getTime() - DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const rows = await getDb().task.findMany({
    where: {
      assignees: { some: { memberId } },
      // Everything still open, and what was finished recently enough to
      // still be worth seeing — a board with no memory looks like no work.
      OR: [
        { status: { not: "DONE" } },
        { status: "DONE", updatedAt: { gte: doneSince } },
      ],
    },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    take: TASKS_LIMIT,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      project: { select: { slug: true, title: true } },
    },
  });

  return groupTasks(rows, now);
}
