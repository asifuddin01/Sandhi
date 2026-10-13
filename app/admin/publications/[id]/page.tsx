import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import {
  getPublicationForEdit,
  getPublicationLinkOptions,
  publicationDraft,
} from "@/lib/admin/publications";
import { requireCapability } from "@/lib/authz";
import { publicationStageLabels } from "@/lib/publications";
import { isPublicationPublic } from "@/lib/visibility";

import { PublicationEditor } from "../PublicationEditor";
import { ReviewPanel } from "../ReviewPanel";

export const metadata: Metadata = { title: "Edit publication" };

export default async function EditPublicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("publications:publish", `/admin/publications/${id}`);
  const [publication, options] = await Promise.all([
    getPublicationForEdit(id),
    getPublicationLinkOptions(),
  ]);
  if (!publication) notFound();
  const { created } = await searchParams;
  const live = isPublicationPublic(publication);

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/publications">Publications</Link>
      </nav>
      <header className={styles.header}>
        <h1>{publication.title}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/publications/${publication.id}/preview`}>
            Preview
          </Link>
          {live ? (
            <Link href={`/publications/${publication.slug}`}>View on site</Link>
          ) : null}
          <span className={styles.hint}>
            Stage:{" "}
            {
              publicationStageLabels[
                publication.stage as keyof typeof publicationStageLabels
              ]
            }
          </span>
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Publication created.
          </p>
        ) : null}
        {publication._count.resources + publication._count.newsPosts > 0 ? (
          <p className={styles.hint}>
            Linked from {publication._count.resources} resource
            {publication._count.resources === 1 ? "" : "s"} and{" "}
            {publication._count.newsPosts} news post
            {publication._count.newsPosts === 1 ? "" : "s"}, so it is archived
            rather than deleted.
          </p>
        ) : null}
      </header>

      <PublicationEditor
        options={options}
        publication={publicationDraft(publication)}
      />

      <ReviewPanel
        publicationId={publication.id}
        stage={publication.stage}
        reviews={publication.reviews.map((review) => ({
          id: review.id,
          comment: review.comment,
          decision: review.decision,
          reviewer: review.reviewer?.name ?? "A former member",
          createdAt: review.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
