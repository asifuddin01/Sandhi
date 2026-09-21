import { Prose } from "@/components/Prose";
import type { MemberAnnouncement } from "@/lib/portal-content";

import styles from "@/app/(public)/ContentPages.module.css";

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/**
 * Lab announcements, in the News section, for people in the lab.
 *
 * The page renders this only when `getMemberAnnouncements` has returned
 * something, and that returns nothing at all without a member record — so a
 * signed-out visitor sees no section, no heading, and no sign that one
 * exists.
 */
export async function MemberNotices({
  announcements,
}: {
  announcements: MemberAnnouncement[];
}) {
  if (announcements.length === 0) return null;

  return (
    <section aria-labelledby="member-notices" className={styles.memberNotices}>
      <header className={styles.memberNoticesHead}>
        {/* "Lab announcements", not "Announcements": the public news
            categories below already include one called Announcements, and
            two things with one name on one page is a trap. */}
        <h2 id="member-notices">Lab announcements</h2>
        <p className={styles.memberOnly}>
          For people in the lab. Not shown on the public site.
        </p>
      </header>
      {announcements.map((announcement) => (
        <article className={styles.notice} key={announcement.id}>
          <h3 className={styles.noticeTitle}>
            {announcement.pinned ? "Pinned · " : ""}
            {announcement.title}
          </h3>
          <Prose>{announcement.body}</Prose>
          <p className={styles.noticeMeta}>
            {announcement.author?.name ?? "The lab"} ·{" "}
            <time dateTime={announcement.createdAt.toISOString()}>
              {when.format(announcement.createdAt)}
            </time>
          </p>
        </article>
      ))}
    </section>
  );
}
