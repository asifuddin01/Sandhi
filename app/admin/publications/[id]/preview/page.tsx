import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { PublicationDetail } from "@/components/entries/PublicationDetail";
import { requireCapability } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { getPublicationForPreview } from "@/lib/public-content";
import { isPublicationPublic } from "@/lib/visibility";

export const metadata: Metadata = { title: "Preview" };

export default async function PublicationPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "publications:publish",
    `/admin/publications/${id}/preview`,
  );
  const [publication, row] = await Promise.all([
    getPublicationForPreview(id),
    getDb().publication.findUnique({
      where: { id },
      select: { state: true, stage: true, type: true, arxivId: true },
    }),
  ]);
  if (!publication || !row) notFound();

  return (
    <>
      <p className={styles.previewBanner} role="status">
        {isPublicationPublic(row)
          ? "Preview of the live page."
          : "Preview: this publication is not public yet."}{" "}
        <Link href={`/admin/publications/${id}`}>Back to editing</Link>
      </p>
      <PublicationDetail publication={publication} />
    </>
  );
}
