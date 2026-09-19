import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { getNewsLinkOptions } from "@/lib/admin/news";
import { requireCapability } from "@/lib/authz";

import { NewsEditor } from "../NewsEditor";

export const metadata: Metadata = { title: "New post" };

export default async function NewNewsPage() {
  await requireCapability("content:manage", "/admin/news/new");
  const options = await getNewsLinkOptions();

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/news">News</Link>
      </nav>
      <header className={styles.header}>
        <h1>New post</h1>
        <p>Saved as a draft until you choose to publish or schedule it.</p>
      </header>
      <NewsEditor options={options} />
    </>
  );
}
