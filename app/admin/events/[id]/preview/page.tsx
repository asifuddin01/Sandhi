import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { EventDetail } from "@/components/events/EventDetail";
import { requireCapability } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { getEventForPreview } from "@/lib/public-events";

export const metadata: Metadata = { title: "Preview" };

export default async function EventPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("content:manage", `/admin/events/${id}/preview`);
  const row = await getDb().event.findUnique({
    where: { id },
    select: { state: true, kind: true },
  });
  if (!row) notFound();
  const event = await getEventForPreview(id);

  return (
    <>
      <p className={styles.previewBanner} role="status">
        {!event
          ? "Internal events have no public page."
          : row.state === "PUBLISHED"
            ? "Preview of the live page."
            : "Preview: this event is not public yet."}{" "}
        <Link href={`/admin/events/${id}`}>Back to editing</Link>
      </p>
      {event ? <EventDetail event={event} preview /> : null}
    </>
  );
}
