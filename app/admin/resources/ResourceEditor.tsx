import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  MarkdownField,
  TitleSlugFields,
} from "@/components/admin/ContentFields";
import type {
  getResourceForEdit,
  getResourceLinkOptions,
} from "@/lib/admin/resources";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { RESOURCE_KIND_LABELS, RESOURCE_KINDS } from "@/lib/public-resources";

import { saveResourceAction } from "./actions";

type ResourceRecord = NonNullable<
  Awaited<ReturnType<typeof getResourceForEdit>>
>;
type Options = Awaited<ReturnType<typeof getResourceLinkOptions>>;

const links = [
  ["downloadUrl", "Download link"],
  ["repoUrl", "Repository link"],
  ["docsUrl", "Documentation link"],
  ["hfUrl", "Hugging Face link"],
] as const;

export function ResourceEditor({
  resource,
  options,
}: {
  resource?: ResourceRecord;
  options: Options;
}) {
  const chosen = new Set(resource?.areas.map(({ areaId }) => areaId));
  return (
    <ActionForm action={saveResourceAction}>
      {resource ? <input type="hidden" name="id" value={resource.id} /> : null}
      <TitleSlugFields
        titleLabel="Name"
        defaultTitle={resource?.name}
        defaultSlug={resource?.slug}
        pathPrefix="/resources/"
      />
      <MarkdownField
        id="description"
        name="description"
        label="Description"
        defaultValue={resource?.description}
        rows={10}
      />
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="kind">Kind</label>
          <select
            id="kind"
            name="kind"
            defaultValue={resource?.kind ?? "DATASET"}
          >
            {RESOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {RESOURCE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="license">Licence</label>
          <input
            id="license"
            name="license"
            maxLength={120}
            placeholder="CC BY 4.0"
            defaultValue={resource?.license ?? ""}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="version">Version</label>
          <input
            id="version"
            name="version"
            maxLength={60}
            defaultValue={resource?.version ?? ""}
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
                defaultValue={resource?.[name] ?? ""}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div className={styles.field}>
        <label htmlFor="bibtex">BibTeX</label>
        <textarea
          id="bibtex"
          name="bibtex"
          rows={5}
          spellCheck={false}
          defaultValue={resource?.bibtex ?? ""}
        />
      </div>
      <MarkdownField
        id="changelog"
        name="changelog"
        label="Changelog"
        defaultValue={resource?.changelog ?? ""}
        rows={6}
        hint="Optional. Markdown."
      />
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="projectId">Related project</label>
          <select
            id="projectId"
            name="projectId"
            defaultValue={resource?.projectId ?? ""}
          >
            <option value="">None</option>
            {options.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="publicationId">Related publication</label>
          <select
            id="publicationId"
            name="publicationId"
            defaultValue={resource?.publicationId ?? ""}
          >
            <option value="">None</option>
            {options.publications.map((publication) => (
              <option key={publication.id} value={publication.id}>
                {publication.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className={styles.fieldset}>
        <legend>Research areas</legend>
        {options.areas.map((area) => (
          <label className={styles.check} key={area.id}>
            <input
              type="checkbox"
              name="areaIds"
              value={area.id}
              defaultChecked={chosen.has(area.id)}
            />
            <span>{area.name}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.field}>
        <label htmlFor="state">State</label>
        <select
          id="state"
          name="state"
          defaultValue={resource?.state ?? "DRAFT"}
        >
          {unscheduledStates.map((state) => (
            <option key={state} value={state}>
              {publishStateLabels[state]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pending="Saving…">
        {resource ? "Save changes" : "Create resource"}
      </SubmitButton>
    </ActionForm>
  );
}
