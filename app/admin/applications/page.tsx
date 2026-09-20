import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import { getApplicationsIndex } from "@/lib/admin/applications";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  joinTypeOptions,
  typeLabel,
} from "@/lib/applications";
import { requireCapability } from "@/lib/authz";

export const metadata: Metadata = { title: "Applications" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ApplicationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("applications:manage", "/admin/applications");
  const params = await searchParams;
  const status = single(params.status);
  const type = single(params.type);
  const query = single(params.q);
  const { applications, total, page, pages, counts, open } =
    await getApplicationsIndex({
      status,
      type,
      query,
      page: Number(single(params.page)) || 1,
    });

  const link = (target: { status?: string; type?: string; page?: number }) => {
    const next = new URLSearchParams();
    const wantedStatus = target.status ?? status;
    const wantedType = target.type ?? type;
    if (wantedStatus) next.set("status", wantedStatus);
    if (wantedType) next.set("type", wantedType);
    if (query) next.set("q", query);
    if (target.page && target.page > 1) next.set("page", String(target.page));
    const text = next.toString();
    return text ? `/admin/applications?${text}` : "/admin/applications";
  };

  return (
    <>
      <header className={styles.header}>
        <h1>Applications</h1>
        <p>
          Everyone who has written in through Join SANDHI.{" "}
          {open === 1
            ? "One is still waiting on an answer."
            : `${open} are still waiting on an answer.`}
        </p>
      </header>

      <form
        className={styles.filters}
        role="search"
        action="/admin/applications"
      >
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <label className="visually-hidden" htmlFor="application-search">
          Search applications
        </label>
        <input
          defaultValue={query}
          id="application-search"
          name="q"
          placeholder="Name, email, or institution"
          type="search"
        />
        <button type="submit">Search</button>
        {query ? <Link href={link({})}>Clear</Link> : null}
      </form>

      <nav className={styles.filters} aria-label="Filter by state">
        <Link
          aria-current={status ? undefined : "page"}
          href={link({ status: "" })}
        >
          All ({total})
        </Link>
        {APPLICATION_STATUSES.map((value) => (
          <Link
            aria-current={status === value ? "page" : undefined}
            href={link({ status: value })}
            key={value}
          >
            {APPLICATION_STATUS_LABELS[value]} ({counts[value] ?? 0})
          </Link>
        ))}
      </nav>

      <nav className={styles.filters} aria-label="Filter by path">
        <Link
          aria-current={type ? undefined : "page"}
          href={link({ type: "" })}
        >
          Every path
        </Link>
        {joinTypeOptions.map((option) => (
          <Link
            aria-current={type === option.value ? "page" : undefined}
            href={link({ type: option.value })}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {applications.length === 0 ? (
        <p className={styles.empty}>
          {query || status || type
            ? "Nothing matches that."
            : "Nobody has applied yet."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">
              Applications, newest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Applicant</th>
                <th scope="col">Path</th>
                <th scope="col">State</th>
                <th scope="col">Rating</th>
                <th scope="col">Sent</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <Link href={`/admin/applications/${application.id}`}>
                      {application.name}
                    </Link>
                    <span className={styles.rowSub}>
                      {application.currentRole} · {application.institution}
                      {application.notes > 0
                        ? ` · ${application.notes} note${
                            application.notes === 1 ? "" : "s"
                          }`
                        : ""}
                    </span>
                  </td>
                  <td>
                    {typeLabel(application.type)}
                    {application.opportunity ? (
                      <span className={styles.rowSub}>
                        {application.opportunity.title}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {APPLICATION_STATUS_LABELS[
                      application.status as keyof typeof APPLICATION_STATUS_LABELS
                    ] ?? application.status}
                  </td>
                  <td>{application.rating ?? "—"}</td>
                  <td>
                    <time dateTime={application.createdAt.toISOString()}>
                      {formatAdminTime(application.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className={styles.filters}>
          {page > 1 ? (
            <Link href={link({ page: page - 1 })}>Previous</Link>
          ) : null}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={link({ page: page + 1 })}>Next</Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
