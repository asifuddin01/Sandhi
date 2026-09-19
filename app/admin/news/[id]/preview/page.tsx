import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { NewsArticle } from "@/components/entries/NewsArticle";
import { requireCapability } from "@/lib/authz";
import { publicStatus, type PublishStateValue } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { getNewsDetailForPreview } from "@/lib/public-content";

export const metadata: Metadata = { title: "Preview" };

export default async function NewsPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("content:manage", `/admin/news/${id}/preview`);
  const [post, row] = await Promise.all([
    getNewsDetailForPreview(id),
    getDb().newsPost.findUnique({
      where: { id },
      select: { state: true, publishAt: true },
    }),
  ]);
  if (!post || !row) notFound();
  const status = publicStatus(row.state as PublishStateValue, row.publishAt);

  return (
    <>
      <p className={styles.previewBanner} role="status">
        {status === "live"
          ? "Preview of the live page."
          : "Preview: this post is not public yet."}{" "}
        <Link href={`/admin/news/${id}`}>Back to editing</Link>
      </p>
      <NewsArticle post={post} />
    </>
  );
}
