import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { getThemeForEdit } from "@/lib/admin/research";
import { requireCapability } from "@/lib/authz";

import { ThemeEditor } from "../ResearchEditors";

export const metadata: Metadata = { title: "Edit theme" };

export default async function EditThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("research:manage", `/admin/research/${id}`);
  const theme = await getThemeForEdit(id);
  if (!theme) notFound();
  const { created } = await searchParams;
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/research">Research themes</Link>
      </nav>
      <header className={styles.header}>
        <h1>{theme.name}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/research/${theme.id}/preview`}>Preview</Link>
          {theme.state === "PUBLISHED" ? (
            <Link href={`/research/${theme.slug}`}>View on site</Link>
          ) : null}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Theme created.
          </p>
        ) : null}
      </header>
      <ThemeEditor theme={theme} />
    </>
  );
}
