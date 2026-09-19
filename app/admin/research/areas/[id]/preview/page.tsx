import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { AreaDetail } from "@/components/entries/AreaDetail";
import { requireCapability } from "@/lib/authz";
import { getAreaForPreview } from "@/lib/public-research";

export const metadata: Metadata = { title: "Preview" };

export default async function AreaPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "research:manage",
    `/admin/research/areas/${id}/preview`,
  );
  const area = await getAreaForPreview(id);
  if (!area) notFound();
  return (
    <>
      <p className={styles.previewBanner} role="status">
        Preview: visitors see this area only while it and its theme are
        published.{" "}
        <Link href={`/admin/research/areas/${id}`}>Back to editing</Link>
      </p>
      <AreaDetail area={area} />
    </>
  );
}
