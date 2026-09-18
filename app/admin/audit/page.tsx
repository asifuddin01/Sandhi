import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import type { Prisma } from "@/generated/prisma/client";
import { requireCapability } from "@/lib/authz";
import { getDb } from "@/lib/db";

export const metadata: Metadata = {
  title: "Audit log",
};

const PAGE_SIZE = 50;

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Dhaka",
});

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 80) ?? "";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string | string[];
    action?: string | string[];
    page?: string | string[];
  }>;
}) {
  await requireCapability("audit:view", "/admin/audit");
  const params = await searchParams;
  const entity = single(params.entity);
  const action = single(params.action);
  const page = Math.min(1000, Math.max(1, Number(single(params.page)) || 1));

  const where: Prisma.AuditLogWhereInput = {
    ...(entity ? { entity } : {}),
    ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
  };
  const db = getDb();
  const [entries, total, entities] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        diff: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    db.auditLog.count({ where }),
    // GROUP BY in SQL; Prisma's `distinct` would fetch every row.
    db.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (target: number) => {
    const query = new URLSearchParams();
    if (entity) query.set("entity", entity);
    if (action) query.set("action", action);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `/admin/audit?${text}` : "/admin/audit";
  };

  return (
    <>
      <header className={styles.header}>
        <h1>Audit log</h1>
        <p>
          Every administrative change, newest first. Entries cannot be edited.
        </p>
      </header>

      <form className={styles.filters} method="get" role="search">
        <div className={styles.field}>
          <label htmlFor="audit-entity">Record type</label>
          <select id="audit-entity" name="entity" defaultValue={entity}>
            <option value="">Any type</option>
            {entities.map((item) => (
              <option key={item.entity} value={item.entity}>
                {item.entity}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-action">Action contains</label>
          <input
            id="audit-action"
            name="action"
            type="search"
            defaultValue={action}
          />
        </div>
        <button className={styles.quietButton} type="submit">
          Filter
        </button>
      </form>

      {entries.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Record</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <time dateTime={entry.createdAt.toISOString()}>
                      {timeFormat.format(entry.createdAt)}
                    </time>
                  </td>
                  <td>
                    {entry.actor?.name ?? "Removed account"}
                    {entry.actor ? (
                      <span className={styles.secondary}>
                        {entry.actor.email}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {entry.action}
                    {entry.diff !== null ? (
                      <details className={styles.diff}>
                        <summary>Changes</summary>
                        <pre>{JSON.stringify(entry.diff, null, 2)}</pre>
                      </details>
                    ) : null}
                  </td>
                  <td>
                    {entry.entity}
                    <span className={styles.secondary}>{entry.entityId}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.empty}>No entries match.</p>
      )}

      <nav className={styles.pagination} aria-label="Audit log pages">
        {page > 1 ? <Link href={pageLink(page - 1)}>Newer entries</Link> : null}
        <span>
          Page {Math.min(page, pages)} of {pages}
        </span>
        {page < pages ? (
          <Link href={pageLink(page + 1)}>Older entries</Link>
        ) : null}
      </nav>
    </>
  );
}
