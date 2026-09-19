import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { getResearchAreaOptions } from "@/lib/admin/opportunities";
import { requireCapability } from "@/lib/authz";

import { OpportunityEditor } from "../OpportunityEditor";

export const metadata: Metadata = { title: "New opportunity" };

export default async function NewOpportunityPage() {
  await requireCapability("opportunities:manage", "/admin/opportunities/new");
  const areas = await getResearchAreaOptions();
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/opportunities">Opportunities</Link>
      </nav>
      <header className={styles.header}>
        <h1>New opportunity</h1>
        <p>Saved as a draft until you publish it.</p>
      </header>
      <OpportunityEditor areas={areas} />
    </>
  );
}
