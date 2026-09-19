import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { OpportunityDetail } from "@/components/entries/OpportunityDetail";
import { requireCapability } from "@/lib/authz";
import { getOpportunityForPreview } from "@/lib/public-opportunities";

export const metadata: Metadata = { title: "Preview" };

export default async function OpportunityPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "opportunities:manage",
    `/admin/opportunities/${id}/preview`,
  );
  const opportunity = await getOpportunityForPreview(id);
  if (!opportunity) notFound();

  return (
    <>
      <p className={styles.previewBanner} role="status">
        Preview: visitors see this page only while it is published and open.{" "}
        <Link href={`/admin/opportunities/${id}`}>Back to editing</Link>
      </p>
      <OpportunityDetail opportunity={opportunity} />
    </>
  );
}
