import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  MarkdownField,
  TitleSlugFields,
} from "@/components/admin/ContentFields";
import { TeamField } from "@/components/admin/TeamField";
import type {
  getProjectForEdit,
  getProjectOptions,
} from "@/lib/admin/projects";
import { PROJECT_STATUSES } from "@/lib/admin/projects";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { humanizeEnum } from "@/lib/public-content";

import { saveProjectAction } from "./actions";

type ProjectRecord = NonNullable<Awaited<ReturnType<typeof getProjectForEdit>>>;
type Options = Awaited<ReturnType<typeof getProjectOptions>>;

const narrative = [
  ["motivation", "Motivation"],
  ["approach", "Approach"],
  ["experiments", "Experiments"],
  ["results", "Results"],
] as const;

const links = [
  ["codeUrl", "Code link"],
  ["datasetUrl", "Dataset link"],
  ["demoUrl", "Demo link"],
] as const;

function dateValue(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function ProjectEditor({
  project,
  options,
}: {
  project?: ProjectRecord;
  options: Options;
}) {
  const areas = new Set(project?.areas.map(({ areaId }) => areaId));
  const related = new Set(project?.relatedFrom.map(({ toId }) => toId));

  return (
    <ActionForm action={saveProjectAction}>
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <TitleSlugFields
        defaultTitle={project?.title}
        defaultSlug={project?.slug}
        pathPrefix="/projects/"
      />
      <div className={styles.field}>
        <label htmlFor="gloss">One-line description</label>
        <input
          id="gloss"
          name="gloss"
          maxLength={200}
          defaultValue={project?.gloss}
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="question">Research question</label>
        <input
          id="question"
          name="question"
          maxLength={400}
          defaultValue={project?.question}
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="abstract">Abstract</label>
        <textarea
          id="abstract"
          name="abstract"
          rows={4}
          maxLength={1500}
          defaultValue={project?.abstract}
          required
        />
      </div>

      {narrative.map(([name, label]) => (
        <MarkdownField
          key={name}
          id={name}
          name={name}
          label={label}
          defaultValue={project?.[name] ?? ""}
          rows={8}
          hint="Optional. Markdown."
        />
      ))}
      <label className={styles.check}>
        <input
          type="checkbox"
          name="resultsPublic"
          defaultChecked={project?.resultsPublic ?? false}
        />
        <span>Show the experiments and results publicly</span>
      </label>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="status">Project status</label>
          <select
            id="status"
            name="status"
            defaultValue={project?.status ?? "PROPOSED"}
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanizeEnum(status)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="startedAt">Started</label>
          <input
            id="startedAt"
            name="startedAt"
            type="date"
            defaultValue={dateValue(project?.startedAt)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="endedAt">Ended</label>
          <input
            id="endedAt"
            name="endedAt"
            type="date"
            defaultValue={dateValue(project?.endedAt)}
          />
        </div>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Links</legend>
        <div className={styles.fieldRow}>
          {links.map(([name, label]) => (
            <div className={styles.field} key={name}>
              <label htmlFor={name}>{label}</label>
              <input
                id={name}
                name={name}
                type="url"
                placeholder="https://"
                defaultValue={project?.[name] ?? ""}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <TeamField
        members={options.members}
        defaultRows={
          project?.members.map(({ memberId, role, isLead }) => ({
            memberId,
            role,
            isLead,
          })) ?? []
        }
      />

      <fieldset className={styles.fieldset}>
        <legend>Research areas</legend>
        {options.areas.map((area) => (
          <label className={styles.check} key={area.id}>
            <input
              type="checkbox"
              name="areaIds"
              value={area.id}
              defaultChecked={areas.has(area.id)}
            />
            <span>{area.name}</span>
          </label>
        ))}
      </fieldset>

      {options.projects.length > 0 ? (
        <fieldset className={styles.fieldset}>
          <legend>Related projects</legend>
          {options.projects.map((other) => (
            <label className={styles.check} key={other.id}>
              <input
                type="checkbox"
                name="relatedIds"
                value={other.id}
                defaultChecked={related.has(other.id)}
              />
              <span>{other.title}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="state">State</label>
          <select
            id="state"
            name="state"
            defaultValue={project?.state ?? "DRAFT"}
          >
            {unscheduledStates.map((state) => (
              <option key={state} value={state}>
                {publishStateLabels[state]}
              </option>
            ))}
          </select>
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="featured"
            defaultChecked={project?.featured ?? false}
          />
          <span>Feature on the home page</span>
        </label>
      </div>
      <SubmitButton pending="Saving…">
        {project ? "Save changes" : "Create project"}
      </SubmitButton>
    </ActionForm>
  );
}
