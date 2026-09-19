import Link from "next/link";

import { AttachedFiles } from "@/components/entries/AttachedFiles";
import { Prose } from "@/components/Prose";
import { projectStatusLabel } from "@/lib/project-status";
import type { ProjectUpdateEntry } from "@/lib/public-research";

import styles from "./ProjectUpdates.module.css";

/**
 * Dhaka time, not UTC: an update is stamped when it was written, and the
 * portal shows the team the same day for the same post. A note written late
 * in the evening must not read as yesterday's on the public page.
 */
const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Dhaka",
  year: "numeric",
});

/**
 * What the team has said about a running project, newest first. These are
 * written in the portal and published one at a time, so this is the public
 * half of `/portal/projects/[slug]` — never a mirror of it.
 */
export function ProjectUpdates({ updates }: { updates: ProjectUpdateEntry[] }) {
  if (updates.length === 0) return null;

  return (
    <ol className={styles.thread}>
      {updates.map((update, index) => {
        const posted = new Date(update.postedAt);
        return (
          <li
            className={styles.update}
            data-latest={index === 0 ? "true" : undefined}
            key={update.id}
          >
            <div className={styles.marker} aria-hidden="true">
              <span />
            </div>
            <div className={styles.body}>
              <p className={styles.meta}>
                <time dateTime={update.postedAt}>
                  {dateFormatter.format(posted)}
                </time>
                <span>{projectStatusLabel(update.stage)}</span>
                {update.author ? (
                  <span>
                    {update.author.memberSlug ? (
                      <Link href={`/people/${update.author.memberSlug}`}>
                        {update.author.name}
                      </Link>
                    ) : (
                      update.author.name
                    )}
                  </span>
                ) : null}
              </p>
              <h3 className={styles.title}>{update.title}</h3>
              <Prose className={styles.prose}>{update.body}</Prose>
              <AttachedFiles files={update.attachments} />
              {update.nextUp ? (
                <p className={styles.next}>
                  <span className={styles.nextLabel}>Next</span>
                  {update.nextUp}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
