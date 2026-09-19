import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import {
  getPublicationForEdit,
  getPublicationLinkOptions,
} from "@/lib/admin/publications";
import { requireCapability } from "@/lib/authz";
import { publicationStageLabels } from "@/lib/publications";
import { isPublicationPublic } from "@/lib/visibility";

import { PublicationEditor } from "../PublicationEditor";
import { ReviewPanel } from "../ReviewPanel";

export const metadata: Metadata = { title: "Edit publication" };

function dateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

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
        publication={{
          id: publication.id,
          title: publication.title,
          slug: publication.slug,
          abstract: publication.abstract,
          type: publication.type,
          stage: publication.stage,
          state: publication.state,
          venueName: publication.venueName ?? "",
          venueShort: publication.venueShort ?? "",
          year: publication.year ? String(publication.year) : "",
          publishedAt: dateInput(publication.publishedAt),
          doi: publication.doi ?? "",
          arxivId: publication.arxivId ?? "",
          pdfUrl: publication.pdfUrl ?? "",
          codeUrl: publication.codeUrl ?? "",
          datasetUrl: publication.datasetUrl ?? "",
          pageUrl: publication.pageUrl ?? "",
          bibtexOverride: publication.bibtexOverride ?? "",
          award: publication.award ?? "",
          featured: publication.featured,
          projectId: publication.projectId ?? "",
          areaIds: publication.areaIds,
          authors: publication.authors,
        }}
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
