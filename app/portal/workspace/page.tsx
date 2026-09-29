import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { LAB_TIME_ZONE } from "@/lib/portal/dashboard";
import { getMemberWorkspace } from "@/lib/portal/experiments";

import { RecordExperiment } from "./WorkspaceForms";

export const metadata: Metadata = { title: "Research workspace" };

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: LAB_TIME_ZONE,
});

export default async function PortalWorkspacePage() {
  const viewer = await requireViewer("/portal/workspace");
  const workspace = await getMemberWorkspace(viewer);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal">Portal</Link>
        </p>
        <h1>Research workspace</h1>
        <p className={styles.lead}>
          What has been tried on your projects, with the settings it was run
          under and what came of it.
        </p>
      </header>

      <section aria-labelledby="experiments" className={styles.section}>
        <h2 id="experiments">Experiments</h2>
        {workspace && workspace.experiments.length > 0 ? (
          <ul className={styles.cardList}>
            {workspace.experiments.map((experiment) => (
              <li className={styles.card} key={experiment.id}>
                <h3>
                  <Link href={`/portal/workspace/${experiment.id}`}>
                    {experiment.name}
                  </Link>
                </h3>
                {experiment.hypothesis ? <p>{experiment.hypothesis}</p> : null}
                <p className={styles.cardMeta}>
                  {experiment.project.title}
                  {" · "}
                  {experiment.owner.name}
                  {experiment.milestone ? ` · ${experiment.milestone}` : ""}
                  {" · Last touched "}
                  <time dateTime={experiment.updatedAt.toISOString()}>
                    {when.format(experiment.updatedAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>
            Nothing recorded yet. An experiment here is a record somebody else
            can read a year from now, so write down what you actually ran.
          </p>
        )}
      </section>

      {/* Nothing to record against until somebody is on a project. */}
      {workspace && workspace.projects.length > 0 ? (
        <section aria-labelledby="record" className={styles.section}>
          <h2 id="record">Record an experiment</h2>
          <RecordExperiment projects={workspace.projects} />
        </section>
      ) : null}
    </div>
  );
}
