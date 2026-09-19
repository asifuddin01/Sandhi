import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import { getEventForEdit, getEventRegistrations } from "@/lib/admin/events";
import { requireCapability } from "@/lib/authz";
import { can } from "@/lib/permissions";

import { EventEditor } from "../EventEditor";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const viewer = await requireCapability(
    "content:manage",
    `/admin/events/${id}`,
  );
  const event = await getEventForEdit(id);
  if (!event) notFound();
  const { created } = await searchParams;
  const seesRegistrants = can(viewer.role, "members:manage");
  const registrations = seesRegistrants ? await getEventRegistrations(id) : [];
  const live = event.state === "PUBLISHED" && event.kind !== "INTERNAL";

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/events">Events</Link>
      </nav>
      <header className={styles.header}>
        <h1>{event.title}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/events/${event.id}/preview`}>Preview</Link>
          {live ? (
            <Link href={`/events/${event.slug}`}>View on site</Link>
          ) : null}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Event created.
          </p>
        ) : null}
      </header>
      <EventEditor event={event} />

      <section
        className={styles.section}
        aria-labelledby="registrations-heading"
      >
        <h2 id="registrations-heading">
          Registrations ({event._count.registrations})
        </h2>
        {!seesRegistrants ? (
          <p className={styles.empty}>
            Only administrators can see who registered.
          </p>
        ) : registrations.length === 0 ? (
          <p className={styles.empty}>Nobody has registered yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Affiliation</th>
                  <th scope="col">Registered</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => (
                  <tr key={registration.id}>
                    <td>{registration.name}</td>
                    <td>{registration.email}</td>
                    <td>{registration.affiliation ?? ""}</td>
                    <td>{formatAdminTime(registration.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
