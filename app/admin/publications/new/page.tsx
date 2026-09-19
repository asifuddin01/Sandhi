import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { getPublicationLinkOptions } from "@/lib/admin/publications";
import { requireCapability } from "@/lib/authz";

import { PublicationEditor } from "../PublicationEditor";

export const metadata: Metadata = { title: "New publication" };

export default async function NewPublicationPage() {
  await requireCapability("publications:publish", "/admin/publications/new");
  const options = await getPublicationLinkOptions();

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/publications">Publications</Link>
      </nav>
      <header className={styles.header}>
        <h1>New publication</h1>
        <p>
          Import it by DOI or arXiv id, or fill it in by hand. Saved as a draft
          until you publish it.
        </p>
      </header>
      <PublicationEditor options={options} />
    </>
  );
}
