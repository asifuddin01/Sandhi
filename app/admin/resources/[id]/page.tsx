import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import {
  getResourceForEdit,
  getResourceLinkOptions,
} from "@/lib/admin/resources";
import { requireCapability } from "@/lib/authz";

import { ResourceEditor } from "../ResourceEditor";

export const metadata: Metadata = { title: "Edit resource" };

export default async function EditResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("content:manage", `/admin/resources/${id}`);
  const [resource, options] = await Promise.all([
    getResourceForEdit(id),
    getResourceLinkOptions(),
  ]);
  if (!resource) notFound();
  const { created } = await searchParams;

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/resources">Resources</Link>
      </nav>
      <header className={styles.header}>
        <h1>{resource.name}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/resources/${resource.id}/preview`}>Preview</Link>
          {resource.state === "PUBLISHED" ? (
            <Link href={`/resources/${resource.slug}`}>View on site</Link>
          ) : null}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Resource created.
          </p>
        ) : null}
      </header>
      <ResourceEditor resource={resource} options={options} />
    </>
  );
}
