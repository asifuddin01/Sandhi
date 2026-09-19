"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  AuthorsField,
  type AuthorRowValue,
} from "@/components/admin/AuthorsField";
import { TitleSlugFields } from "@/components/admin/ContentFields";
import { PUBLICATION_TYPES } from "@/lib/bibtex";
import {
  idleImportState,
  PUBLICATION_STAGES,
  publicationStageLabels,
  publicationTypeLabels,
} from "@/lib/publications";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import type { ImportedPublication } from "@/lib/scholarly-import";

import { importPublicationAction, savePublicationAction } from "./actions";

export interface PublicationDraft {
  id?: string;
  title: string;
  slug: string;
  abstract: string;
  type: string;
  stage: string;
  state: string;
  venueName: string;
  venueShort: string;
  year: string;
  publishedAt: string;
  doi: string;
  arxivId: string;
  pdfUrl: string;
  codeUrl: string;
  datasetUrl: string;
  pageUrl: string;
  bibtexOverride: string;
  award: string;
  featured: boolean;
  projectId: string;
  areaIds: string[];
  authors: AuthorRowValue[];
}

export interface EditorOptions {
  members: ReadonlyArray<{ id: string; name: string }>;
  projects: ReadonlyArray<{ id: string; title: string }>;
  areas: ReadonlyArray<{ id: string; name: string; theme: { name: string } }>;
}

export const emptyDraft: PublicationDraft = {
  title: "",
  slug: "",
  abstract: "",
  type: "CONFERENCE",
  stage: "DRAFT",
  state: "DRAFT",
  venueName: "",
  venueShort: "",
  year: "",
  publishedAt: "",
  doi: "",
  arxivId: "",
  pdfUrl: "",
  codeUrl: "",
  datasetUrl: "",
  pageUrl: "",
  bibtexOverride: "",
  award: "",
  featured: false,
  projectId: "",
  areaIds: [],
  authors: [],
};

/**
 * What an import fills in. It never touches the fields it knows nothing about
 * (the stage, the project, the areas), and matching an imported author name to
 * a member is left to a person: two researchers share a name often enough.
 */
function applyImport(
  draft: PublicationDraft,
  imported: ImportedPublication,
): PublicationDraft {
  return {
    ...draft,
    title: imported.title || draft.title,
    abstract: imported.abstract || draft.abstract,
    type: imported.type,
    venueName: imported.venueName ?? draft.venueName,
    year: imported.year ? String(imported.year) : draft.year,
    publishedAt: imported.publishedOn ?? draft.publishedAt,
    doi: imported.doi ?? draft.doi,
    arxivId: imported.arxivId ?? draft.arxivId,
    pdfUrl: imported.pdfUrl ?? draft.pdfUrl,
    authors:
      imported.authors.length > 0
        ? imported.authors.map((name) => ({
            memberId: null,
            externalName: name,
            externalAffiliation: null,
            equalContribution: false,
            corresponding: false,
          }))
        : draft.authors,
  };
}

export function PublicationEditor({
  publication,
  options,
}: {
  publication?: PublicationDraft;
  options: EditorOptions;
}) {
  const [draft, setDraft] = useState(publication ?? emptyDraft);
  // An import replaces the form, so the fields are remounted with new
  // defaults rather than each one being held in state.
  const [revision, setRevision] = useState(0);
  const [importState, importAction] = useActionState(
    importPublicationAction,
    idleImportState,
  );
  // Each lookup returns a new result object, so applying it once is a matter
  // of remembering which object was applied, not counting how many times.
  const applied = useRef<unknown>(null);

  useEffect(() => {
    if (importState.status !== "ready" || applied.current === importState) {
      return;
    }
    applied.current = importState;
    setDraft((current) => applyImport(current, importState.publication));
    setRevision((current) => current + 1);
  }, [importState]);

  return (
    <>
      <form className={styles.importPanel} action={importAction}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="import-identifier">DOI or arXiv id</label>
            <input
              id="import-identifier"
              name="identifier"
              maxLength={300}
              placeholder="10.1038/nature14539"
              aria-describedby="import-hint"
            />
            <p id="import-hint" className={styles.hint}>
              Fills the form below from Crossref or arXiv, replacing what is
              there. Check every field afterwards: imported records are often
              incomplete, and authors always come in as typed names.
            </p>
          </div>
          <div className={styles.field}>
            <label htmlFor="import-source">Look up in</label>
            <select id="import-source" name="source" defaultValue="doi">
              <option value="doi">Crossref (DOI)</option>
              <option value="arxiv">arXiv</option>
            </select>
          </div>
          <div className={styles.rowActions}>
            <SubmitButton tone="quiet" pending="Looking up…">
              Import
            </SubmitButton>
          </div>
        </div>
        <p
          className={styles.actionMessage}
          data-tone={
            importState.status === "error"
              ? "error"
              : importState.status === "ready"
                ? "success"
                : "idle"
          }
          role={importState.status === "error" ? "alert" : "status"}
        >
          {importState.status === "error"
            ? importState.message
            : importState.status === "ready"
              ? "Imported. Check the fields below before saving."
              : ""}
        </p>
      </form>

      <ActionForm key={revision} action={savePublicationAction}>
        {publication?.id ? (
          <input type="hidden" name="id" value={publication.id} />
        ) : null}

        <TitleSlugFields
          defaultTitle={draft.title}
          defaultSlug={draft.slug}
          pathPrefix="/publications/"
        />

        <div className={styles.field}>
          <label htmlFor="abstract">Abstract</label>
          <textarea
            id="abstract"
            name="abstract"
            rows={6}
            maxLength={10_000}
            defaultValue={draft.abstract}
            required
          />
        </div>

        <AuthorsField members={options.members} defaultRows={draft.authors} />

        <fieldset className={styles.fieldset}>
          <legend>Where it appears</legend>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="type">Type</label>
              <select id="type" name="type" defaultValue={draft.type}>
                {PUBLICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {publicationTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="venueName">Venue</label>
              <input
                id="venueName"
                name="venueName"
                maxLength={300}
                defaultValue={draft.venueName}
                placeholder="Conference on Neural Information Processing Systems"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="venueShort">Short venue</label>
              <input
                id="venueShort"
                name="venueShort"
                maxLength={80}
                defaultValue={draft.venueShort}
                placeholder="NeurIPS"
              />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="year">Year</label>
              <input
                id="year"
                name="year"
                type="number"
                min={1900}
                max={new Date().getUTCFullYear() + 5}
                step={1}
                defaultValue={draft.year}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="publishedAt">Date</label>
              <input
                id="publishedAt"
                name="publishedAt"
                type="date"
                defaultValue={draft.publishedAt}
                aria-describedby="publishedAt-hint"
              />
              <p id="publishedAt-hint" className={styles.hint}>
                When it is known to the day.
              </p>
            </div>
            <div className={styles.field}>
              <label htmlFor="award">Award</label>
              <input
                id="award"
                name="award"
                maxLength={200}
                defaultValue={draft.award}
                placeholder="Best paper"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Identifiers and links</legend>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="doi">DOI</label>
              <input
                id="doi"
                name="doi"
                maxLength={300}
                defaultValue={draft.doi}
                placeholder="10.1038/nature14539"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="arxivId">arXiv id</label>
              <input
                id="arxivId"
                name="arxivId"
                maxLength={60}
                defaultValue={draft.arxivId}
                placeholder="1706.03762"
                aria-describedby="arxiv-hint"
              />
              <p id="arxiv-hint" className={styles.hint}>
                A preprint is public only once it has one.
              </p>
            </div>
          </div>
          <div className={styles.fieldRow}>
            {(
              [
                ["pdfUrl", "PDF"],
                ["pageUrl", "Page"],
                ["codeUrl", "Code"],
                ["datasetUrl", "Dataset"],
              ] as const
            ).map(([name, label]) => (
              <div className={styles.field} key={name}>
                <label htmlFor={name}>{label}</label>
                <input
                  id={name}
                  name={name}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  defaultValue={draft[name]}
                />
              </div>
            ))}
          </div>
          <div className={styles.field}>
            <label htmlFor="bibtexOverride">BibTeX override</label>
            <textarea
              id="bibtexOverride"
              name="bibtexOverride"
              rows={4}
              maxLength={5000}
              defaultValue={draft.bibtexOverride}
              aria-describedby="bibtex-hint"
            />
            <p id="bibtex-hint" className={styles.hint}>
              Leave empty to generate the entry from the fields above. Fill it
              in only when the publisher&rsquo;s own entry must be used exactly.
            </p>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Research</legend>
          <div className={styles.field}>
            <label htmlFor="projectId">Project</label>
            <select
              id="projectId"
              name="projectId"
              defaultValue={draft.projectId}
            >
              <option value="">None</option>
              {options.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          <fieldset className={styles.checkGroup}>
            <legend>Research areas</legend>
            {options.areas.map((area) => (
              <label className={styles.check} key={area.id}>
                <input
                  type="checkbox"
                  name="areaIds"
                  value={area.id}
                  defaultChecked={draft.areaIds.includes(area.id)}
                />
                <span>
                  {area.name}{" "}
                  <span className={styles.hint}>{area.theme.name}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Stage and visibility</legend>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="stage">Stage</label>
              <select id="stage" name="stage" defaultValue={draft.stage}>
                {PUBLICATION_STAGES.map((stage, index) => (
                  <option key={stage} value={stage}>
                    {index + 1}. {publicationStageLabels[stage]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="state">State</label>
              <select id="state" name="state" defaultValue={draft.state}>
                {unscheduledStates.map((state) => (
                  <option key={state} value={state}>
                    {publishStateLabels[state]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className={styles.hint}>
            A publication reaches the public site only when its state is
            Published <em>and</em> its stage is Accepted or Published — or it is
            a preprint with an arXiv id.
          </p>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="featured"
              defaultChecked={draft.featured}
            />
            <span>Feature this publication</span>
          </label>
        </fieldset>

        <SubmitButton pending="Saving…">
          {publication?.id ? "Save changes" : "Create publication"}
        </SubmitButton>
      </ActionForm>
    </>
  );
}
