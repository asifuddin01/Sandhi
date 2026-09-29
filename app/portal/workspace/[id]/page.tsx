import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/Prose";
import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { LAB_TIME_ZONE } from "@/lib/portal/dashboard";
import { getMemberExperiment } from "@/lib/portal/experiments";

import {
  AddLogEntry,
  DeleteExperiment,
  EditExperiment,
} from "../WorkspaceForms";

export const metadata: Metadata = { title: "Experiment" };

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: LAB_TIME_ZONE,
});

/**
 * Stored JSON, shown as text. It is rendered inside `<pre>`, never parsed
 * into markup and never run: this is somebody's configuration, not code the
 * page should act on.
 */
function Json({ value, label }: { value: unknown; label: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className={styles.field}>
      <p className={styles.label}>{label}</p>
      <pre className={styles.jsonBlock}>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default async function PortalExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer(`/portal/workspace/${id}`);
  const found = await getMemberExperiment(viewer, id);
  if (!found) notFound();

  const { experiment, log } = found;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal/workspace">Research workspace</Link>
        </p>
        <h1>{experiment.name}</h1>
        <p className={styles.lead}>
          <Link href={`/portal/projects/${experiment.project.slug}`}>
            {experiment.project.title}
          </Link>
          {" · run by "}
          {experiment.owner.name}
        </p>
        {experiment.trackingUrl ? (
          <div className={styles.actions}>
            <a
              className={styles.textButton}
              href={experiment.trackingUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              Open the tracking run
            </a>
          </div>
        ) : null}
      </header>

      <section aria-labelledby="what" className={styles.section}>
        <h2 id="what">What was tried</h2>
        {experiment.hypothesis ? (
          <p className={styles.readonly}>{experiment.hypothesis}</p>
        ) : (
          <p className={styles.hint}>No hypothesis written down.</p>
        )}
        <dl className={styles.facts}>
          {experiment.modelInfo ? (
            <div>
              <dt>Model</dt>
              <dd>{experiment.modelInfo}</dd>
            </div>
          ) : null}
          {experiment.milestone ? (
            <div>
              <dt>Milestone</dt>
              <dd>{experiment.milestone}</dd>
            </div>
          ) : null}
          {experiment.datasetRefs.length > 0 ? (
            <div>
              <dt>Datasets</dt>
              <dd>{experiment.datasetRefs.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
        <Json label="Configuration" value={experiment.config} />
        <Json label="Results" value={experiment.results} />
      </section>

      {experiment.notes ? (
        <section aria-labelledby="notes" className={styles.section}>
          <h2 id="notes">Notes</h2>
          <Prose>{experiment.notes}</Prose>
        </section>
      ) : null}

      <section aria-labelledby="log" className={styles.section}>
        <h2 id="log">Log</h2>
        {log.length > 0 ? (
          <ol className={styles.logList}>
            {log.map((entry) => (
              <li className={styles.logEntry} key={entry.id}>
                <p className={styles.cardMeta}>
                  <time dateTime={entry.createdAt.toISOString()}>
                    {when.format(entry.createdAt)}
                  </time>
                </p>
                <p className={styles.readonly}>{entry.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.hint}>Nothing logged yet.</p>
        )}
        {experiment.editable ? (
          <AddLogEntry experimentId={experiment.id} />
        ) : null}
      </section>

      {experiment.editable ? (
        <>
          <section aria-labelledby="edit" className={styles.section}>
            <h2 id="edit">Change this experiment</h2>
            <EditExperiment experiment={experiment} />
          </section>
          <section aria-labelledby="remove" className={styles.section}>
            <h2 id="remove">Delete it</h2>
            <p className={styles.hint}>
              This removes the experiment and its whole log, for everyone on the
              project.
            </p>
            <DeleteExperiment experimentId={experiment.id} />
          </section>
        </>
      ) : null}
    </div>
  );
}
