import type { Metadata } from "next";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import { requireCapability } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";

import { AnnouncementControls, PostAnnouncement } from "./AnnouncementForms";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsAdminPage() {
  await requireCapability("content:manage", "/admin/announcements");
  const announcements = isDatabaseConfigured()
    ? await getDb().announcement.findMany({
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          title: true,
          body: true,
          pinned: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      })
    : [];

  return (
    <>
      <header className={styles.header}>
        <h1>Announcements</h1>
        <p>
          Notices for the people in the lab — a deadline, a seminar, a change of
          plan. They appear in the News section for anybody signed in with a
          member record, and for nobody else. A news post is the public thing;
          this is not one.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="post">
        <h2 id="post">Post one</h2>
        <PostAnnouncement />
      </section>

      <section className={styles.section} aria-labelledby="posted">
        <h2 id="posted">Posted</h2>
        {announcements.length === 0 ? (
          <p className={styles.empty}>Nothing has been announced yet.</p>
        ) : (
          <ul className={styles.noteList}>
            {announcements.map((announcement) => (
              <li key={announcement.id}>
                <span>
                  {announcement.pinned ? "Pinned · " : ""}
                  <strong>{announcement.title}</strong>
                </span>
                <span>{announcement.body}</span>
                <span className={styles.hint}>
                  {announcement.author?.name ?? "A former member"} ·{" "}
                  <time dateTime={announcement.createdAt.toISOString()}>
                    {formatAdminTime(announcement.createdAt)}
                  </time>
                </span>
                <AnnouncementControls
                  id={announcement.id}
                  pinned={announcement.pinned}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
