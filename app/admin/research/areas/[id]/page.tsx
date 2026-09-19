import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { getAreaForEdit, getThemeOptions } from "@/lib/admin/research";
import { requireCapability } from "@/lib/authz";

import { AreaEditor } from "../../ResearchEditors";

export const metadata: Metadata = { title: "Edit area" };

export default async function EditAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("research:manage", `/admin/research/areas/${id}`);
  const [area, themes] = await Promise.all([
    getAreaForEdit(id),
    getThemeOptions(),
  ]);
  if (!area) notFound();
  const { created } = await searchParams;
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/research/areas">Research areas</Link>
      </nav>
      <header className={styles.header}>
        <h1>{area.name}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/research/areas/${area.id}/preview`}>Preview</Link>
          {area.state === "PUBLISHED" ? (
            <Link href={`/research/areas/${area.slug}`}>View on site</Link>
          ) : null}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Area created.
          </p>
        ) : null}
      </header>
      <AreaEditor area={area} themes={themes} />
    </>
  );
}
