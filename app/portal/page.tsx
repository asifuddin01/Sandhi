import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Dashboard.module.css";
import portal from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { can } from "@/lib/permissions";
import type { MemberAnnouncement, MemberProject } from "@/lib/portal-content";
import {
  announcementPreview,
  getMemberDashboard,
  greeting,
  LAB_TIME_ZONE,
  type DueTask,
} from "@/lib/portal/dashboard";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/portal/progress-limits";

import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: "Portal",
};

const roleNames = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  REVIEWER: "Reviewer",
  MEMBER: "Member",
} as const;

const today = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: LAB_TIME_ZONE,
});

const dueDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: LAB_TIME_ZONE,
});

const noticeDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: LAB_TIME_ZONE,
});

function Counts({
  counts,
  announcements,
}: {
  counts: {
    projects: number;
    leading: number;
    openTasks: number;
    publicationsInProgress: number;
  };
  announcements: number;
}) {
  const figures = [
    {
      value: counts.projects,
      label: counts.projects === 1 ? "project" : "projects",
      note: counts.leading > 0 ? `${counts.leading} leading` : null,
      href: "/portal/projects",
    },
    {
      value: counts.openTasks,
      label: counts.openTasks === 1 ? "open task" : "open tasks",
      note: null,
      href: "/portal/tasks",
    },
    {
      value: counts.publicationsInProgress,
      label:
        counts.publicationsInProgress === 1
          ? "paper in progress"
          : "papers in progress",
      note: null,
      href: "/portal/publications",
    },
    {
      value: announcements,
      label: announcements === 1 ? "announcement" : "announcements",
      note: null,
      href: "/news",
    },
  ];

  return (
    /* No heading of its own to point at, so the section names itself. */
    <section aria-label="At a glance" className={styles.glance}>
      <dl className={styles.counts}>
        {figures.map((figure) => (
          <div className={styles.count} key={figure.label}>
            <dt>
              {figure.label}
              {figure.note ? (
                <span className={styles.countNote}> · {figure.note}</span>
              ) : null}
            </dt>
            <dd>
              {figure.href ? (
                <Link href={figure.href}>{figure.value}</Link>
              ) : (
                figure.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DueSoon({ tasks }: { tasks: DueTask[] }) {
  return (
    <section aria-labelledby="due-soon" className={styles.section}>
      <h2 id="due-soon">Due in the next two weeks</h2>
      {tasks.length === 0 ? (
        <p className={portal.hint}>Nothing due in the next two weeks.</p>
      ) : (
        <ul className={styles.dueList}>
          {tasks.map((task) => (
            <li
              className={styles.due}
              data-overdue={task.overdue ? "true" : undefined}
              key={task.id}
            >
              <p className={styles.dueTitle}>{task.title}</p>
              <p className={styles.dueMeta}>
                {/* The word as well as the colour: a border alone says
                    nothing to somebody who cannot see the difference. */}
                {task.overdue ? (
                  <>
                    <span className={styles.overdue}>Overdue</span>
                    {" · "}
                  </>
                ) : null}
                <time dateTime={task.dueAt.toISOString()}>
                  {dueDate.format(task.dueAt)}
                </time>
                {` · ${TASK_PRIORITY_LABELS[task.priority] ?? task.priority} priority`}
                {` · ${TASK_STATUS_LABELS[task.status] ?? task.status}`}
                {task.project ? (
                  <>
                    {" · "}
                    <Link href={`/portal/projects/${task.project.slug}`}>
                      {task.project.title}
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Announcements({
  announcements,
}: {
  announcements: MemberAnnouncement[];
}) {
  return (
    <section aria-labelledby="lab-announcements" className={styles.section}>
      {/* "Lab announcements", not "Announcements": the public News page
          already has a category by that name. */}
      <h2 id="lab-announcements">Lab announcements</h2>
      {announcements.length === 0 ? (
        <p className={portal.hint}>No announcements.</p>
      ) : (
        <ul className={portal.cardList}>
          {announcements.map((announcement) => (
            <li className={portal.card} key={announcement.id}>
              <h3>
                {announcement.pinned ? "Pinned · " : ""}
                {announcement.title}
              </h3>
              <p>{announcementPreview(announcement.body)}</p>
              <p className={portal.cardMeta}>
                {announcement.author?.name ?? "The lab"}
                {" · "}
                <time dateTime={announcement.createdAt.toISOString()}>
                  {noticeDate.format(announcement.createdAt)}
                </time>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className={portal.aside}>
        <Link href="/news">All announcements</Link>
      </p>
    </section>
  );
}

function Projects({ projects }: { projects: MemberProject[] }) {
  return (
    <section aria-labelledby="your-projects" className={styles.section}>
      <h2 id="your-projects">Your projects</h2>
      {projects.length === 0 ? (
        <p className={portal.hint}>You are not on a project yet.</p>
      ) : (
        <ul className={portal.cardList}>
          {projects.map((project) => (
            <li className={portal.card} key={project.id}>
              <h3>
                <Link href={`/portal/projects/${project.slug}`}>
                  {project.title}
                </Link>
              </h3>
              <p>{project.gloss}</p>
              <p className={portal.cardMeta}>
                {project.role}
                {project.isLead ? " · Lead" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className={portal.aside}>
        <Link href="/portal/projects">All your projects</Link>
      </p>
    </section>
  );
}

export default async function PortalPage() {
  const viewer = await requireViewer("/portal");
  const dashboard = await getMemberDashboard(viewer);
  const now = new Date();

  return (
    <div className={portal.page}>
      <header className={portal.intro}>
        <h1>Welcome, {viewer.member?.name ?? viewer.name}</h1>
        <p className={portal.lead}>
          {greeting(now)} · {today.format(now)}
        </p>
        <p className={portal.aside}>
          Signed in as {viewer.email} · {roleNames[viewer.role]}
        </p>
      </header>

      {dashboard ? (
        <>
          <Counts
            announcements={dashboard.announcements.length}
            counts={dashboard.counts}
          />
          <DueSoon tasks={dashboard.dueSoon} />
          <Announcements announcements={dashboard.announcements} />
          <Projects projects={dashboard.projects} />
        </>
      ) : (
        <p className={portal.notice}>
          Your account is not linked to a profile yet. Ask an administrator.
        </p>
      )}

      <section aria-labelledby="elsewhere" className={styles.links}>
        <h2 id="elsewhere">Elsewhere in the portal</h2>
        <div className={portal.actions}>
          {can(viewer.role, "admin:access") ? (
            <Link className="button button-primary" href="/admin">
              Open administration
            </Link>
          ) : null}
          <Link className={portal.textButton} href="/portal/projects">
            My projects
          </Link>
          <Link className={portal.textButton} href="/portal/tasks">
            My tasks
          </Link>
          <Link className={portal.textButton} href="/portal/meetings">
            Meetings
          </Link>
          <Link className={portal.textButton} href="/portal/publications">
            My publications
          </Link>
          <Link className={portal.textButton} href="/portal/proposals">
            Proposals
          </Link>
          <Link className={portal.textButton} href="/portal/diagrams">
            Diagrams
          </Link>
          <Link className={portal.textButton} href="/portal/profile">
            Your profile
          </Link>
          <Link className={portal.textButton} href="/portal/security">
            Account security
          </Link>
          <form action={signOutAction}>
            <button className={portal.textButton} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
