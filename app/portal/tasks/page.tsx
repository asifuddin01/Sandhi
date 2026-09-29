import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { LAB_TIME_ZONE } from "@/lib/portal/dashboard";
import { TASK_PRIORITY_LABELS } from "@/lib/portal/progress-limits";
import { getMemberTasks } from "@/lib/portal/tasks";

import { TaskState } from "./TaskState";

export const metadata: Metadata = { title: "Your tasks" };

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: LAB_TIME_ZONE,
});

export default async function PortalTasksPage() {
  const viewer = await requireViewer("/portal/tasks");
  const groups = await getMemberTasks(viewer);
  const total =
    groups?.reduce((sum, group) => sum + group.tasks.length, 0) ?? 0;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal">Portal</Link>
        </p>
        <h1>Your tasks</h1>
        <p className={styles.lead}>
          Everything assigned to you, across every project you are on. Move a
          task along here and the project board says the same thing.
        </p>
      </header>

      {total === 0 ? (
        <p className={styles.hint}>
          Nothing is assigned to you. Work is handed out on a project&rsquo;s
          own page, by whoever leads it.
        </p>
      ) : null}

      {/* An empty group is left out rather than shown empty: no overdue work
          is good news, and a heading saying so is noise. */}
      {groups
        ?.filter((group) => group.tasks.length > 0)
        .map((group) => (
          <section
            aria-labelledby={`group-${group.key}`}
            className={styles.section}
            key={group.key}
          >
            <h2 id={`group-${group.key}`}>{group.heading}</h2>
            {group.note ? <p className={styles.hint}>{group.note}</p> : null}
            <ul className={styles.cardList}>
              {group.tasks.map((task) => (
                <li className={styles.card} key={task.id}>
                  <h3>{task.title}</h3>
                  {task.description ? <p>{task.description}</p> : null}
                  <p className={styles.cardMeta}>
                    {task.dueAt ? (
                      <>
                        <time dateTime={task.dueAt.toISOString()}>
                          {when.format(task.dueAt)}
                        </time>
                        {" · "}
                      </>
                    ) : null}
                    {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                    {" priority"}
                    {task.project ? (
                      <>
                        {" · "}
                        <Link href={`/portal/projects/${task.project.slug}`}>
                          {task.project.title}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {task.project ? (
                    <TaskState
                      slug={task.project.slug}
                      status={task.status}
                      taskId={task.id}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
