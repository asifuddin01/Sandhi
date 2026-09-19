import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { PartnerDirectory } from "@/components/partners/PartnerDirectory";
import { requireCapability } from "@/lib/authz";
import { getPartnerForPreview } from "@/lib/public-partners";

export const metadata: Metadata = { title: "Preview" };

export default async function PartnerPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("partners:manage", `/admin/partners/${id}/preview`);
  const partner = await getPartnerForPreview(id);
  if (!partner) notFound();
  return (
    <>
      <p className={styles.previewBanner} role="status">
        Preview of this partner as it appears on the Partners page.{" "}
        <Link href={`/admin/partners/${id}`}>Back to editing</Link>
      </p>
      <PartnerDirectory partners={[partner]} />
    </>
  );
}
