import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { getThemeOptions } from "@/lib/admin/research";
import { requireCapability } from "@/lib/authz";

import { AreaEditor } from "../../ResearchEditors";

export const metadata: Metadata = { title: "New area" };

export default async function NewAreaPage() {
  await requireCapability("research:manage", "/admin/research/areas/new");
  const themes = await getThemeOptions();
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/research/areas">Research areas</Link>
      </nav>
      <header className={styles.header}>
        <h1>New area</h1>
        <p>Saved as a draft until you publish it.</p>
      </header>
      <AreaEditor themes={themes} />
    </>
  );
}
