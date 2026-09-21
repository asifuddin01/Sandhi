import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { requireCapability } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { publicProjectWhere, publicPublicationWhere } from "@/lib/visibility";

export const metadata: Metadata = {
  title: "Dashboard",
};

const numberFormat = new Intl.NumberFormat("en");
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

export default async function AdminDashboardPage() {
  const viewer = await requireCapability("admin:access", "/admin");
  const db = getDb();
  const showAudit = can(viewer.role, "audit:view");
  const readsApplications = can(viewer.role, "applications:manage");

  const [
    activeMembers,
    publicProjects,
    totalProjects,
    publicPublications,
    totalPublications,
    newApplications,
    pendingChanges,
    publicationsInReview,
    insightsInReview,
    recentAudit,
  ] = await Promise.all([
    db.member.count({ where: { status: "ACTIVE" } }),
    db.project.count({ where: publicProjectWhere }),
    db.project.count(),
    db.publication.count({ where: publicPublicationWhere }),
    db.publication.count(),
    db.application.count({ where: { status: "NEW" } }),
    db.changeRequest.count({ where: { status: "PENDING" } }),
    db.publication.count({ where: { stage: "INTERNAL_REVIEW" } }),
    db.insight.count({ where: { state: "IN_REVIEW" } }),
    showAudit
      ? db.auditLog.findMany({
          // Sign-ins and other account events stay in the audit log.
          where: { NOT: { action: { startsWith: "auth." } } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            action: true,
            entity: true,
            createdAt: true,
            actor: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // A count with nowhere to go is a count nobody acts on, so the rows that
  // have somewhere to go carry the link — but only for a reader who can
  // actually open it, or the link is an invitation to a 404.
  const pending = [
    [
      "New applications",
      newApplications,
      readsApplications ? "/admin/applications" : null,
    ],
    [
      "Profile changes awaiting approval",
      pendingChanges,
      can(viewer.role, "approvals:manage") ? "/admin/approvals" : null,
    ],
    ["Publications in internal review", publicationsInReview, null],
    ["Research notes in review", insightsInReview, null],
  ] as const;

  return (
    <>
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <p>The lab at a glance, counted from the database.</p>
      </header>

      <dl className={styles.figures}>
        <div className={styles.figure}>
          <dt>Active members</dt>
          <dd>{numberFormat.format(activeMembers)}</dd>
        </div>
        <div className={styles.figure}>
          <dt>Projects</dt>
          <dd>
            {numberFormat.format(publicProjects)}{" "}
            <span>public of {numberFormat.format(totalProjects)}</span>
          </dd>
        </div>
        <div className={styles.figure}>
          <dt>Publications</dt>
          <dd>
            {numberFormat.format(publicPublications)}{" "}
            <span>public of {numberFormat.format(totalPublications)}</span>
          </dd>
        </div>
      </dl>

      <section className={styles.section} aria-labelledby="pending-heading">
        <h2 id="pending-heading">Waiting for attention</h2>
        <ul className={styles.rows}>
          {pending.map(([label, count, href]) => (
            <li key={label}>
              <span>{href ? <Link href={href}>{label}</Link> : label}</span>
              <span>{numberFormat.format(count)}</span>
            </li>
          ))}
        </ul>
      </section>

      {showAudit ? (
        <section className={styles.section} aria-labelledby="audit-heading">
          <h2 id="audit-heading">Recent activity</h2>
          {recentAudit.length > 0 ? (
            <ul className={styles.rows}>
              {recentAudit.map((entry) => (
                <li key={entry.id}>
                  <span>
                    {entry.actor?.name ?? "System"} · {entry.action} ·{" "}
                    {entry.entity}
                  </span>
                  <span>
                    <time dateTime={entry.createdAt.toISOString()}>
                      {timeFormat.format(entry.createdAt)}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No administrative activity yet.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
