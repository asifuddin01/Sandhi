import {
  PROJECT_STAGE_WALK,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  projectStatusLabel,
} from "@/lib/project-status";

import styles from "./ProjectStage.module.css";

/**
 * Where a project has got to, as a numbered thread — the same device the
 * publication workflow uses, so "how far along is this" reads the same way
 * everywhere on the site.
 *
 * Archived is not a step on the way anywhere, so it is stated rather than
 * drawn as the end of the thread.
 */
const WALK = PROJECT_STAGE_WALK;

export function ProjectStage({
  status,
  heading = "Progress",
}: {
  status: string;
  heading?: string;
}) {
  if (!PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number])) {
    return null;
  }
  const reached = WALK.indexOf(status as (typeof WALK)[number]);

  if (reached === -1) {
    return (
      <p className={styles.aside}>
        {heading}: {projectStatusLabel(status)}.
      </p>
    );
  }

  return (
    <div className={styles.stage}>
      <h3 className={styles.heading}>{heading}</h3>
      <ol className={styles.thread}>
        {WALK.map((step, index) => {
          const state =
            index < reached ? "done" : index === reached ? "now" : "ahead";
          return (
            <li className={styles.step} data-state={state} key={step}>
              <span className={styles.mark} aria-hidden="true" />
              <span className={styles.label}>
                {PROJECT_STATUS_LABELS[step]}
                {state === "now" ? (
                  <span className={styles.nowLabel}> — now</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
