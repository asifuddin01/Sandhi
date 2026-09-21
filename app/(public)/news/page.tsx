import type { Metadata } from "next";
import Link from "next/link";

import { ContentEmptyState } from "@/components/entries/ContentEmptyState";
import { MemberNotices } from "@/components/entries/MemberNotices";
import { NewsEntry } from "@/components/entries/NewsEntry";
import { getViewer } from "@/lib/authz";
import { getMemberAnnouncements } from "@/lib/portal-content";
import {
  getPublicNews,
  humanizeEnum,
  NEWS_CATEGORIES,
} from "@/lib/public-content";

import styles from "../ContentPages.module.css";

export const metadata: Metadata = {
  title: "News",
  description:
    "Research updates, publication announcements, events, and news from SANDHI Research Lab.",
  alternates: { canonical: "/news" },
  openGraph: {
    title: "News | SANDHI Research Lab",
    description: "Research updates and announcements from SANDHI Research Lab.",
    url: "/news",
    type: "website",
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const requestedCategory = one(query.category);
  const category = NEWS_CATEGORIES.find((item) => item === requestedCategory);
  const posts = await getPublicNews(category);

  // Announcements are for the lab, so they are read per viewer and never
  // cached with the public page. Somebody signed out gets an empty list and
  // therefore no section at all.
  const viewer = await getViewer();
  const announcements = viewer ? await getMemberAnnouncements(viewer, 5) : [];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>News</h1>
        <p className={styles.lead}>
          Research updates, publication announcements, events, and notes from
          the team.
        </p>
      </header>

      <MemberNotices announcements={announcements} />

      <nav className={styles.categoryNav} aria-label="News categories">
        <Link href="/news" data-active={!category}>
          All
        </Link>
        {NEWS_CATEGORIES.map((item) => (
          <Link
            href={`/news?category=${item}`}
            data-active={category === item}
            key={item}
          >
            {humanizeEnum(item)}
          </Link>
        ))}
      </nav>

      {posts.length > 0 ? (
        <div aria-label="News articles">
          {posts.map((post) => (
            <NewsEntry key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <ContentEmptyState
          message={
            category
              ? `No public ${humanizeEnum(category).toLowerCase()} news is available.`
              : "News from the lab will appear here."
          }
          action={
            category ? { href: "/news", label: "View all news" } : undefined
          }
        />
      )}
    </div>
  );
}
