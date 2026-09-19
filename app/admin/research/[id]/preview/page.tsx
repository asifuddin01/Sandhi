import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { ThemeDetail } from "@/components/entries/ThemeDetail";
import { requireCapability } from "@/lib/authz";
import { getThemeForPreview } from "@/lib/public-research";

export const metadata: Metadata = { title: "Preview" };

export default async function ThemePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("research:manage", `/admin/research/${id}/preview`);
  const theme = await getThemeForPreview(id);
  if (!theme) notFound();
  return (
    <>
      <p className={styles.previewBanner} role="status">
        Preview: visitors see this theme only while it is published.{" "}
        <Link href={`/admin/research/${id}`}>Back to editing</Link>
      </p>
      <ThemeDetail theme={theme} />
    </>
  );
}
