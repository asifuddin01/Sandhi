import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { getNewsForEdit, getNewsLinkOptions } from "@/lib/admin/news";
import { requireCapability } from "@/lib/authz";
import { publicStatus, type PublishStateValue } from "@/lib/content-state";

import { NewsEditor } from "../NewsEditor";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("content:manage", `/admin/news/${id}`);
  const [post, options] = await Promise.all([
    getNewsForEdit(id),
    getNewsLinkOptions(),
  ]);
  if (!post) notFound();
  const { created } = await searchParams;
  const live =
    publicStatus(post.state as PublishStateValue, post.publishAt) === "live";

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/news">News</Link>
      </nav>
      <header className={styles.header}>
        <h1>{post.title}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/news/${post.id}/preview`}>Preview</Link>
          {live ? <Link href={`/news/${post.slug}`}>View on site</Link> : null}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Post created.
          </p>
        ) : null}
      </header>
      <NewsEditor post={post} options={options} />
    </>
  );
}
