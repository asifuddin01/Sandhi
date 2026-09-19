import {
  PROJECT_STAGE_WALK,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  projectStatusLabel,
  RESEARCH_PHASE_LABELS,
  RESEARCH_PHASES,
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
  phase = null,
  heading = "Progress",
}: {
  status: string;
  /** The finer step inside a running project, when the team has set one. */
  phase?: string | null;
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
      {status === "ACTIVE" && phase ? <PhaseThread phase={phase} /> : null}
    </div>
  );
}

/**
 * The second thread, drawn only while a project is under way. "Under way"
 * covers a year of very different work; this says which part of it.
 */
function PhaseThread({ phase }: { phase: string }) {
  const reached = RESEARCH_PHASES.indexOf(
    phase as (typeof RESEARCH_PHASES)[number],
  );
  if (reached === -1) return null;

  return (
    <ol className={styles.phases}>
      {RESEARCH_PHASES.map((step, index) => {
        const state =
          index < reached ? "done" : index === reached ? "now" : "ahead";
        return (
          <li className={styles.phase} data-state={state} key={step}>
            <span className={styles.tick} aria-hidden="true" />
            <span className={styles.phaseLabel}>
              {RESEARCH_PHASE_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
