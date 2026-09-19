import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { getProjectOptions } from "@/lib/admin/projects";
import { requireCapability } from "@/lib/authz";

import { ProjectEditor } from "../ProjectEditor";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireCapability("projects:manage", "/admin/projects/new");
  const options = await getProjectOptions();
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/projects">Projects</Link>
      </nav>
      <header className={styles.header}>
        <h1>New project</h1>
        <p>Saved as a draft until you publish it.</p>
      </header>
      <ProjectEditor options={options} />
    </>
  );
}
