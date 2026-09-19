"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/portal/Portal.module.css";
import {
  MAX_SECTION_BODY,
  MAX_SECTION_TITLE,
  SECTION_PRESETS,
} from "@/lib/portal/progress-limits";
import { RESEARCH_PHASE_LABELS, RESEARCH_PHASES } from "@/lib/project-status";

import {
  deleteProjectSectionAction,
  moveProjectSectionAction,
  saveProjectSectionAction,
  setProjectPhaseAction,
  setSectionVisibilityAction,
} from "../actions";

/**
 * The finer step inside a running project. The team sets it, because they are
 * the ones who know whether this week is data or training; the five-stage
 * status above it stays with the administrators.
 */
export function PhasePicker({
  slug,
  phase,
}: {
  slug: string;
  phase: string | null;
}) {
  return (
    <ActionForm action={setProjectPhaseAction} className={styles.inlineForm}>
      <input type="hidden" name="slug" value={slug} />
      <label className={styles.inlineLabel} htmlFor="project-phase">
        Where the work is
      </label>
      <select id="project-phase" name="phase" defaultValue={phase ?? ""}>
        <option value="">Not saying yet</option>
        {RESEARCH_PHASES.map((value) => (
          <option key={value} value={value}>
            {RESEARCH_PHASE_LABELS[value]}
          </option>
        ))}
      </select>
      <SubmitButton tone="quiet" pending="Saving…">
        Set step
      </SubmitButton>
    </ActionForm>
  );
}

/**
 * A standing part of the project's account of itself. Unlike an update, it is
 * edited in place: it is the current answer, so the same form writes a new
 * section and revises an existing one.
 */
export function SectionEditor({
  slug,
  section,
  diagrams,
}: {
  slug: string;
  section?: {
    id: string;
    title: string;
    body: string;
    diagram: { id: string; title: string } | null;
  };
  diagrams: Array<{ id: string; title: string }>;
}) {
  const key = section?.id ?? "new";

  return (
    <ActionForm
      action={saveProjectSectionAction}
      className={styles.form}
      resetOnSuccess={!section}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="sectionId" value={section?.id ?? ""} />

      <div className={styles.field}>
        <label htmlFor={`${key}-title`}>Heading</label>
        <input
          id={`${key}-title`}
          name="title"
          defaultValue={section?.title ?? ""}
          list="section-presets"
          maxLength={MAX_SECTION_TITLE}
          required
        />
        {section ? null : (
          <p className={styles.hint}>
            Methodology, Datasets, Architecture — or whatever this project needs
            to explain.
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={`${key}-body`}>What it says</label>
        <textarea
          id={`${key}-body`}
          name="body"
          rows={section ? 10 : 6}
          defaultValue={section?.body ?? ""}
          maxLength={MAX_SECTION_BODY}
          required
          aria-describedby={`${key}-body-hint`}
        />
        <p className={styles.hint} id={`${key}-body-hint`}>
          Markdown: headings, lists, tables, code blocks and $maths$. Add
          figures and files below once it is saved.
        </p>
      </div>

      {diagrams.length > 0 ? (
        <div className={styles.field}>
          <label htmlFor={`${key}-diagram`}>Diagram</label>
          <select
            id={`${key}-diagram`}
            name="diagramId"
            defaultValue={section?.diagram?.id ?? ""}
          >
            <option value="">None</option>
            {diagrams.map((diagram) => (
              <option key={diagram.id} value={diagram.id}>
                {diagram.title}
              </option>
            ))}
          </select>
          <p className={styles.hint}>
            Kept beside the section for the team. Export it as a PNG from the
            builder and attach it as a figure to show it on the public page.
          </p>
        </div>
      ) : null}

      <SubmitButton pending="Saving…">
        {section ? "Save section" : "Add section"}
      </SubmitButton>
    </ActionForm>
  );
}

export function SectionControls({
  slug,
  sectionId,
  isPublic,
  projectIsPublic,
}: {
  slug: string;
  sectionId: string;
  isPublic: boolean;
  projectIsPublic: boolean;
}) {
  return (
    <div className={styles.updateControls}>
      <ActionForm
        action={setSectionVisibilityAction}
        className={styles.inlineForm}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="isPublic" value={isPublic ? "no" : "yes"} />
        <SubmitButton tone="quiet" pending="Saving…">
          {isPublic ? "Make internal" : "Publish this section"}
        </SubmitButton>
      </ActionForm>
      <ActionForm
        action={moveProjectSectionAction}
        className={styles.inlineForm}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="sectionId" value={sectionId} />
        <SubmitButton
          tone="quiet"
          pending="Moving…"
          name="direction"
          value="up"
        >
          Move up
        </SubmitButton>
        <SubmitButton
          tone="quiet"
          pending="Moving…"
          name="direction"
          value="down"
        >
          Move down
        </SubmitButton>
      </ActionForm>
      <ActionForm
        action={deleteProjectSectionAction}
        className={styles.inlineForm}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="sectionId" value={sectionId} />
        <SubmitButton tone="quiet" pending="Deleting…">
          Delete
        </SubmitButton>
      </ActionForm>
      {!projectIsPublic && !isPublic ? (
        <p className={styles.hint}>
          Publish it now and it appears once the project itself is published.
        </p>
      ) : null}
    </div>
  );
}

/** The preset headings the picker offers, shared by every section form. */
export function SectionPresets() {
  return (
    <datalist id="section-presets">
      {SECTION_PRESETS.map((preset) => (
        <option key={preset} value={preset} />
      ))}
    </datalist>
  );
}
