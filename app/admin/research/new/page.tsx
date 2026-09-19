import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { requireCapability } from "@/lib/authz";

import { ThemeEditor } from "../ResearchEditors";

export const metadata: Metadata = { title: "New theme" };

export default async function NewThemePage() {
  await requireCapability("research:manage", "/admin/research/new");
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/research">Research themes</Link>
      </nav>
      <header className={styles.header}>
        <h1>New theme</h1>
        <p>Saved as a draft until you publish it.</p>
      </header>
      <ThemeEditor />
    </>
  );
}
