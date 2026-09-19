import Link from "next/link";
import type { ReactNode } from "react";

import {
  ActionForm,
  SubmitButton,
  type AdminAction,
} from "@/components/admin/AdminForms";
import { SelectAllRows } from "@/components/admin/ContentFields";
import {
  bulkActionLabels,
  bulkActions,
  publicStatus,
  publishStateLabels,
  type PublishStateValue,
} from "@/lib/content-state";

import styles from "./Admin.module.css";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

export function formatAdminTime(date: Date): string {
  return timeFormat.format(date);
}

/** Live, scheduled for a time, or the state itself. */
export function StatusCell({
  state,
  publishAt = null,
}: {
  state: string;
  publishAt?: Date | null;
}) {
  const value = state as PublishStateValue;
  const visibility = publicStatus(value, publishAt);
  if (visibility === "live") {
    return <span className={styles.statusLive}>Live</span>;
  }
  if (visibility === "scheduled" && publishAt) {
    return (
      <span className={styles.statusScheduled}>
        Scheduled for {timeFormat.format(publishAt)}
      </span>
    );
  }
  return <>{publishStateLabels[value] ?? state}</>;
}

export type ContentFilter = {
  name: string;
  label: string;
  value: string;
  anyLabel: string;
  options: ReadonlyArray<{ value: string; label: string }>;
};

export type ContentRow = {
  id: string;
  title: string;
  href: string;
  secondary?: string;
  cells: ReactNode[];
};

/**
 * The list view every content manager shares: search, filters, bulk
 * actions, and pagination. The bulk form stays mounted when the last row
 * goes, so the message about what happened stays too.
 */
export function ContentIndex({
  heading,
  intro,
  newHref,
  newLabel,
  basePath,
  query,
  filters,
  columns,
  rows,
  bulkAction,
  noun,
  emptyText,
  page,
  pages,
  total,
}: {
  heading: string;
  intro: ReactNode;
  newHref: string;
  newLabel: string;
  basePath: string;
  query: string;
  filters: ContentFilter[];
  columns: string[];
  rows: ContentRow[];
  bulkAction: AdminAction;
  noun: { one: string; many: string };
  emptyText: string;
  page: number;
  pages: number;
  total: number;
}) {
  const filtered = Boolean(query) || filters.some((filter) => filter.value);
  const pageLink = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    for (const filter of filters) {
      if (filter.value) params.set(filter.name, filter.value);
    }
    if (target > 1) params.set("page", String(target));
    const text = params.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  return (
    <>
      <header className={styles.header}>
        <h1>{heading}</h1>
        <p>{intro}</p>
        <p>
          <Link className="button button-primary" href={newHref}>
            {newLabel}
          </Link>
        </p>
      </header>

      <form className={styles.filters} method="get" role="search">
        <div className={styles.field}>
          <label htmlFor="content-q">Search</label>
          <input id="content-q" name="q" type="search" defaultValue={query} />
        </div>
        {filters.map((filter) => (
          <div className={styles.field} key={filter.name}>
            <label htmlFor={`content-${filter.name}`}>{filter.label}</label>
            <select
              id={`content-${filter.name}`}
              name={filter.name}
              defaultValue={filter.value}
            >
              <option value="">{filter.anyLabel}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button className={styles.quietButton} type="submit">
          Filter
        </button>
      </form>

      <ActionForm action={bulkAction}>
        {rows.length > 0 ? (
          <>
            <div className={styles.bulkBar}>
              <div className={styles.field}>
                <label htmlFor="bulkAction">With selected {noun.many}</label>
                <select id="bulkAction" name="bulkAction" defaultValue="">
                  <option value="" disabled>
                    Choose an action
                  </option>
                  {bulkActions.map((action) => (
                    <option key={action} value={action}>
                      {bulkActionLabels[action]}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton tone="quiet" pending="Applying…">
                Apply
              </SubmitButton>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">
                      <SelectAllRows
                        label={`Select every ${noun.one} on this page`}
                      />
                    </th>
                    <th scope="col">Title</th>
                    {columns.map((column) => (
                      <th scope="col" key={column}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          name="ids"
                          value={row.id}
                          aria-label={`Select ${row.title}`}
                        />
                      </td>
                      <td>
                        <Link href={row.href}>{row.title}</Link>
                        {row.secondary ? (
                          <span className={styles.secondary}>
                            {row.secondary}
                          </span>
                        ) : null}
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={columns[index]}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className={styles.empty}>
            {filtered ? `No ${noun.many} match.` : emptyText}
          </p>
        )}
      </ActionForm>

      {pages > 1 ? (
        <nav className={styles.pagination} aria-label={`${heading} pages`}>
          {page > 1 ? <Link href={pageLink(page - 1)}>Previous</Link> : null}
          <span>
            Page {page} of {pages} · {total} {noun.many}
          </span>
          {page < pages ? <Link href={pageLink(page + 1)}>Next</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
