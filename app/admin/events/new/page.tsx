import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { requireCapability } from "@/lib/authz";

import { EventEditor } from "../EventEditor";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireCapability("content:manage", "/admin/events/new");
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/events">Events</Link>
      </nav>
      <header className={styles.header}>
        <h1>New event</h1>
        <p>Saved as a draft until you publish it.</p>
      </header>
      <EventEditor />
    </>
  );
}
