"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/portal/Portal.module.css";
import {
  MAX_DATASETS,
  MAX_EXPERIMENT_NAME,
  MAX_HYPOTHESIS,
  MAX_JSON_TEXT,
  MAX_LOG_ENTRY,
  MAX_MILESTONE,
  MAX_MODEL_INFO,
  MAX_NOTES,
  MAX_TRACKING_URL,
} from "@/lib/portal/experiment-limits";
import type { MemberExperiment } from "@/lib/portal/experiments";

import {
  addLogEntryAction,
  createExperimentAction,
  deleteExperimentAction,
  updateExperimentAction,
} from "./actions";

export interface ProjectOption {
  id: string;
  title: string;
}

/** Stored JSON, laid out for a person to read and edit. */
function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

/**
 * Everything an experiment records, shared by the form that opens one and
 * the form that changes it — so the two cannot come to describe different
 * experiments.
 */
function Fields({ experiment }: { experiment?: MemberExperiment }) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="experiment-name">Name</label>
        <input
          defaultValue={experiment?.name ?? ""}
          id="experiment-name"
          maxLength={MAX_EXPERIMENT_NAME}
          name="name"
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-hypothesis">Hypothesis</label>
        <textarea
          defaultValue={experiment?.hypothesis ?? ""}
          id="experiment-hypothesis"
          maxLength={MAX_HYPOTHESIS}
          name="hypothesis"
          rows={3}
        />
        <p className={styles.hint}>What you expect, and why.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-config">Configuration</label>
        <textarea
          defaultValue={asText(experiment?.config)}
          id="experiment-config"
          maxLength={MAX_JSON_TEXT}
          name="config"
          rows={6}
          spellCheck={false}
        />
        <p className={styles.hint}>
          JSON. Hyperparameters, seeds, anything needed to run it again.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-datasets">Datasets</label>
        <textarea
          defaultValue={(experiment?.datasetRefs ?? []).join("\n")}
          id="experiment-datasets"
          name="datasetRefs"
          rows={3}
        />
        <p className={styles.hint}>
          One per line, up to {MAX_DATASETS}. A name, a path, or a DOI.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-model">Model</label>
        <input
          defaultValue={experiment?.modelInfo ?? ""}
          id="experiment-model"
          maxLength={MAX_MODEL_INFO}
          name="modelInfo"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-results">Results</label>
        <textarea
          defaultValue={asText(experiment?.results)}
          id="experiment-results"
          maxLength={MAX_JSON_TEXT}
          name="results"
          rows={6}
          spellCheck={false}
        />
        <p className={styles.hint}>JSON. Metrics as numbers, not prose.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-notes">Notes</label>
        <textarea
          defaultValue={experiment?.notes ?? ""}
          id="experiment-notes"
          maxLength={MAX_NOTES}
          name="notes"
          rows={5}
        />
        <p className={styles.hint}>Markdown. What the numbers do not say.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-milestone">Milestone</label>
        <input
          defaultValue={experiment?.milestone ?? ""}
          id="experiment-milestone"
          maxLength={MAX_MILESTONE}
          name="milestone"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="experiment-tracking">Tracking link</label>
        <input
          defaultValue={experiment?.trackingUrl ?? ""}
          id="experiment-tracking"
          maxLength={MAX_TRACKING_URL}
          name="trackingUrl"
          placeholder="https://"
          type="url"
        />
        <p className={styles.hint}>
          Weights &amp; Biases, MLflow, or wherever the runs live.
        </p>
      </div>
    </>
  );
}

export function RecordExperiment({ projects }: { projects: ProjectOption[] }) {
  return (
    <ActionForm
      action={createExperimentAction}
      className={styles.form}
      resetOnSuccess
    >
      <div className={styles.field}>
        <label htmlFor="experiment-project">Project</label>
        <select id="experiment-project" name="projectId" required>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </div>

      <Fields />

      <div className={styles.submit}>
        <SubmitButton pending="Recording…">Record it</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditExperiment({
  experiment,
}: {
  experiment: MemberExperiment;
}) {
  return (
    <ActionForm action={updateExperimentAction} className={styles.form}>
      <input type="hidden" name="experimentId" value={experiment.id} />
      <Fields experiment={experiment} />
      <div className={styles.submit}>
        <SubmitButton pending="Saving…">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** The log is append-only: an entry says what happened, then stands. */
export function AddLogEntry({ experimentId }: { experimentId: string }) {
  return (
    <ActionForm
      action={addLogEntryAction}
      className={styles.form}
      resetOnSuccess
    >
      <input type="hidden" name="experimentId" value={experimentId} />
      <div className={styles.field}>
        <label htmlFor="log-body">Add to the log</label>
        <textarea
          id="log-body"
          maxLength={MAX_LOG_ENTRY}
          name="body"
          required
          rows={3}
        />
      </div>
      <div className={styles.submit}>
        <SubmitButton pending="Logging…">Log it</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteExperiment({ experimentId }: { experimentId: string }) {
  return (
    <ActionForm action={deleteExperimentAction} className={styles.inlineForm}>
      <input type="hidden" name="experimentId" value={experimentId} />
      <SubmitButton pending="Deleting…" tone="danger">
        Delete this experiment
      </SubmitButton>
    </ActionForm>
  );
}
