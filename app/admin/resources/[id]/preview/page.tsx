import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { ResourceDetail } from "@/components/entries/ResourceDetail";
import { requireCapability } from "@/lib/authz";
import { getResourceForPreview } from "@/lib/public-resources";

export const metadata: Metadata = { title: "Preview" };

export default async function ResourcePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("content:manage", `/admin/resources/${id}/preview`);
  const resource = await getResourceForPreview(id);
  if (!resource) notFound();
  return (
    <>
      <p className={styles.previewBanner} role="status">
        Preview: visitors see this page only while it is published.{" "}
        <Link href={`/admin/resources/${id}`}>Back to editing</Link>
      </p>
      <ResourceDetail resource={resource} />
    </>
  );
}
