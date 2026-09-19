import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { getPartnerForEdit } from "@/lib/admin/partners";
import { requireCapability } from "@/lib/authz";

import { PartnerEditor } from "../PartnerEditor";

export const metadata: Metadata = { title: "Edit partner" };

export default async function EditPartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("partners:manage", `/admin/partners/${id}`);
  const partner = await getPartnerForEdit(id);
  if (!partner) notFound();
  const { created } = await searchParams;

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/partners">Partners</Link>
      </nav>
      <header className={styles.header}>
        <h1>{partner.name}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/partners/${partner.id}/preview`}>Preview</Link>
          {partner.state === "PUBLISHED" ? (
            <Link href="/partners">View on site</Link>
          ) : null}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Partner added.
          </p>
        ) : null}
      </header>
      <PartnerEditor partner={partner} />
    </>
  );
}
