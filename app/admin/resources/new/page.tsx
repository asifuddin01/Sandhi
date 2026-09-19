import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { getResourceLinkOptions } from "@/lib/admin/resources";
import { requireCapability } from "@/lib/authz";

import { ResourceEditor } from "../ResourceEditor";

export const metadata: Metadata = { title: "New resource" };

export default async function NewResourcePage() {
  await requireCapability("content:manage", "/admin/resources/new");
  const options = await getResourceLinkOptions();
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/resources">Resources</Link>
      </nav>
      <header className={styles.header}>
        <h1>New resource</h1>
        <p>Saved as a draft until you publish it.</p>
      </header>
      <ResourceEditor options={options} />
    </>
  );
}
