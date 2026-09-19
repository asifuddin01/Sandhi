import type { Metadata } from "next";

import {
  ContentIndex,
  formatAdminTime,
  StatusCell,
} from "@/components/admin/ContentIndex";
import { getNewsIndex } from "@/lib/admin/news";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, publishStates } from "@/lib/content-state";
import { humanizeEnum, NEWS_CATEGORIES } from "@/lib/public-content";

import { bulkNewsAction } from "./actions";

export const metadata: Metadata = { title: "News" };

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

  return (
    <ContentIndex
      heading="News"
      intro="Write, schedule, and publish news. Scheduled posts go live on their own at their publish time."
      newHref="/admin/news/new"
      newLabel="New post"
      basePath="/admin/news"
      query={query}
      filters={[
        {
          name: "state",
          label: "State",
          value: state,
          anyLabel: "Any state",
          options: publishStates.map((value) => ({
            value,
            label: publishStateLabels[value],
          })),
        },
        {
          name: "category",
          label: "Category",
          value: category,
          anyLabel: "Any category",
          options: NEWS_CATEGORIES.map((value) => ({
            value,
            label: humanizeEnum(value),
          })),
        },
      ]}
      columns={["Category", "Status", "Updated"]}
      rows={posts.map((post) => ({
        id: post.id,
        title: post.title,
        href: `/admin/news/${post.id}`,
        secondary: `/news/${post.slug}`,
        cells: [
          humanizeEnum(post.category),
          <StatusCell
            key="status"
            state={post.state}
            publishAt={post.publishAt}
          />,
          <time key="updated" dateTime={post.updatedAt.toISOString()}>
            {formatAdminTime(post.updatedAt)}
          </time>,
        ],
      }))}
      bulkAction={bulkNewsAction}
      noun={{ one: "post", many: "posts" }}
      emptyText="No news yet. Write the first post."
      page={page}
      pages={pages}
      total={total}
    />
  );
}
