import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { requireCapability } from "@/lib/authz";

import { PartnerEditor } from "../PartnerEditor";

export const metadata: Metadata = { title: "Add partner" };

export default async function NewPartnerPage() {
  await requireCapability("partners:manage", "/admin/partners/new");
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/partners">Partners</Link>
      </nav>
      <header className={styles.header}>
        <h1>Add partner</h1>
        <p>Saved as a draft until you publish it.</p>
      </header>
      <PartnerEditor />
    </>
  );
}
