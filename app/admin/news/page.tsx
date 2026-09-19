import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import { SelectAllRows } from "@/components/admin/ContentFields";
import { getNewsIndex } from "@/lib/admin/news";
import { requireCapability } from "@/lib/authz";
import {
  bulkActionLabels,
  bulkActions,
  publishStateLabels,
  publishStates,
  type PublishStateValue,
} from "@/lib/content-state";
import { humanizeEnum, NEWS_CATEGORIES } from "@/lib/public-content";

import { bulkNewsAction } from "./actions";

export const metadata: Metadata = { title: "News" };

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function NewsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("content:manage", "/admin/news");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const category = single(params.category);
  const { posts, total, page, pages } = await getNewsIndex({
    query,
    state,
    category,
    page: Number(single(params.page)) || 1,
  });

  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (state) next.set("state", state);
    if (category) next.set("category", category);
    if (target > 1) next.set("page", String(target));
    const text = next.toString();
    return text ? `/admin/news?${text}` : "/admin/news";
  };

  return (
    <>
      <header className={styles.header}>
        <h1>News</h1>
        <p>
          Write, schedule, and publish news. Scheduled posts go live on their
          own at their publish time.
        </p>
        <p>
          <Link className="button button-primary" href="/admin/news/new">
            New post
          </Link>
        </p>
      </header>

      <form className={styles.filters} method="get" role="search">
        <div className={styles.field}>
          <label htmlFor="news-q">Search</label>
          <input id="news-q" name="q" type="search" defaultValue={query} />
        </div>
        <div className={styles.field}>
          <label htmlFor="news-state">State</label>
          <select id="news-state" name="state" defaultValue={state}>
            <option value="">Any state</option>
            {publishStates.map((value) => (
              <option key={value} value={value}>
                {publishStateLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="news-category">Category</label>
          <select id="news-category" name="category" defaultValue={category}>
            <option value="">Any category</option>
            {NEWS_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {humanizeEnum(value)}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.quietButton} type="submit">
          Filter
        </button>
      </form>

      {/* Stays mounted when the last row goes, so its message stays too. */}
      <ActionForm action={bulkNewsAction}>
        {posts.length > 0 ? (
          <>
            <div className={styles.bulkBar}>
              <div className={styles.field}>
                <label htmlFor="bulkAction">With selected posts</label>
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
                      <SelectAllRows label="Select every post on this page" />
                    </th>
                    <th scope="col">Title</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <input
                          type="checkbox"
                          name="ids"
                          value={post.id}
                          aria-label={`Select ${post.title}`}
                        />
                      </td>
                      <td>
                        <Link href={`/admin/news/${post.id}`}>
                          {post.title}
                        </Link>
                        <span className={styles.secondary}>
                          /news/{post.slug}
                        </span>
                      </td>
                      <td>{humanizeEnum(post.category)}</td>
                      <td>
                        {post.visibility === "live" ? (
                          <span className={styles.statusLive}>Live</span>
                        ) : post.visibility === "scheduled" &&
                          post.publishAt ? (
                          <span className={styles.statusScheduled}>
                            Scheduled for {timeFormat.format(post.publishAt)}
                          </span>
                        ) : (
                          publishStateLabels[post.state as PublishStateValue]
                        )}
                      </td>
                      <td>
                        <time dateTime={post.updatedAt.toISOString()}>
                          {timeFormat.format(post.updatedAt)}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className={styles.empty}>
            {query || state || category
              ? "No posts match."
              : "No news yet. Write the first post."}
          </p>
        )}
      </ActionForm>

      {pages > 1 ? (
        <nav className={styles.pagination} aria-label="News pages">
          {page > 1 ? <Link href={pageLink(page - 1)}>Newer</Link> : null}
          <span>
            Page {page} of {pages} · {total} posts
          </span>
          {page < pages ? <Link href={pageLink(page + 1)}>Older</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
