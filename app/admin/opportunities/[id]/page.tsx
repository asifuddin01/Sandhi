import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import {
  getOpportunityForEdit,
  getResearchAreaOptions,
} from "@/lib/admin/opportunities";
import { requireCapability } from "@/lib/authz";

import { OpportunityEditor } from "../OpportunityEditor";

export const metadata: Metadata = { title: "Edit opportunity" };

export default async function EditOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("opportunities:manage", `/admin/opportunities/${id}`);
  const [opportunity, areas] = await Promise.all([
    getOpportunityForEdit(id),
    getResearchAreaOptions(),
  ]);
  if (!opportunity) notFound();
  const { created } = await searchParams;
  const live =
    opportunity.state === "PUBLISHED" &&
    (!opportunity.deadline || opportunity.deadline >= new Date());

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/opportunities">Opportunities</Link>
      </nav>
      <header className={styles.header}>
        <h1>{opportunity.title}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/opportunities/${opportunity.id}/preview`}>
            Preview
          </Link>
          {live ? (
            <Link href={`/opportunities/${opportunity.slug}`}>
              View on site
            </Link>
          ) : null}
        </p>
        <p>
          {opportunity._count.applications === 1
            ? "1 application."
            : `${opportunity._count.applications} applications.`}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Opportunity created.
          </p>
        ) : null}
      </header>
      <OpportunityEditor opportunity={opportunity} areas={areas} />
    </>
  );
}
