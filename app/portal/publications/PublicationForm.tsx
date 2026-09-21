"use client";

import { useId, useState } from "react";

import { ActionMessage, SubmitButton } from "@/components/admin/AdminForms";
import { useFormAction } from "@/components/forms/useFormAction";
import styles from "@/components/portal/Portal.module.css";
import { PUBLICATION_TYPES } from "@/lib/bibtex";
import { MAX_AUTHORS } from "@/lib/publication-authors";
import { publicationTypeLabels } from "@/lib/publications";

import {
  saveMemberPublicationAction,
  type PublicationFormState,
} from "./actions";

const idle: PublicationFormState = { status: "idle" };

export interface AuthorValue {
  memberId: string | null;
  externalName: string | null;
  externalAffiliation: string | null;
  equalContribution: boolean;
  corresponding: boolean;
}

export interface PublicationValues {
  id?: string;
  title: string;
  abstract: string;
  type: string;
  venueName: string;
  venueShort: string;
  year: string;
  doi: string;
  arxivId: string;
  pdfUrl: string;
  codeUrl: string;
  datasetUrl: string;
  pageUrl: string;
  authors: AuthorValue[];
}

const emptyAuthor: AuthorValue = {
  memberId: null,
  externalName: null,
  externalAffiliation: null,
  equalContribution: false,
  corresponding: false,
};

/**
 * What a member records about their own paper. Stage, state, research areas
 * and featuring are absent on purpose: those are the lab's decisions, made in
 * administration, and a form that offered them would be lying about what a
 * member can do.
 */
export function PublicationForm({
  values,
  members,
}: {
  values: PublicationValues;
  members: Array<{ id: string; name: string }>;
}) {
  const fieldId = useId();
  const [authors, setAuthors] = useState<AuthorValue[]>(
    values.authors.length > 0 ? values.authors : [emptyAuthor],
  );
  const { state, formAction, onSubmit } = useFormAction(
    saveMemberPublicationAction,
    idle,
  );

  function update(index: number, change: Partial<AuthorValue>) {
    setAuthors((current) =>
      current.map((author, position) =>
        position === index ? { ...author, ...change } : author,
      ),
    );
  }

  return (
    <form className={styles.form} action={formAction} onSubmit={onSubmit}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-title`}>Title</label>
        <input
          defaultValue={values.title}
          id={`${fieldId}-title`}
          maxLength={300}
          name="title"
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-abstract`}>Abstract</label>
        <textarea
          defaultValue={values.abstract}
          id={`${fieldId}-abstract`}
          name="abstract"
          rows={6}
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-type`}>What kind</label>
        <select defaultValue={values.type} id={`${fieldId}-type`} name="type">
          {PUBLICATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {publicationTypeLabels[type]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-venue`}>Venue</label>
        <input
          defaultValue={values.venueName}
          id={`${fieldId}-venue`}
          name="venueName"
          placeholder="Conference on Computer Vision and Pattern Recognition"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-venue-short`}>Venue, short</label>
        <input
          defaultValue={values.venueShort}
          id={`${fieldId}-venue-short`}
          name="venueShort"
          placeholder="CVPR"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-year`}>Year</label>
        <input
          defaultValue={values.year}
          id={`${fieldId}-year`}
          inputMode="numeric"
          name="year"
          placeholder="2026"
        />
      </div>

      <fieldset className={styles.portrait}>
        <legend className={styles.label}>Authors, in order</legend>
        <p className={styles.hint}>
          Each author is either somebody in the lab or a name you type, never
          both. You are added automatically if you leave yourself off.
        </p>
        {authors.map((author, index) => (
          <div className={styles.field} key={index}>
            <label htmlFor={`${fieldId}-author-${index}`}>
              Author {index + 1}
            </label>
            <select
              id={`${fieldId}-author-${index}`}
              name="authors.memberId"
              onChange={(event) =>
                update(index, {
                  memberId: event.target.value || null,
                  externalName: event.target.value ? null : author.externalName,
                })
              }
              value={author.memberId ?? ""}
            >
              <option value="">Someone outside the lab</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {author.memberId ? (
              // The server reads these positionally, so every author sends
              // one of each field whether or not it carries anything.
              <>
                <input type="hidden" name="authors.externalName" value="" />
                <input
                  type="hidden"
                  name="authors.externalAffiliation"
                  value=""
                />
              </>
            ) : (
              <>
                <input
                  aria-label={`Name of author ${index + 1}`}
                  name="authors.externalName"
                  onChange={(event) =>
                    update(index, { externalName: event.target.value })
                  }
                  placeholder="Their name"
                  value={author.externalName ?? ""}
                />
                <input
                  aria-label={`Affiliation of author ${index + 1}`}
                  name="authors.externalAffiliation"
                  onChange={(event) =>
                    update(index, { externalAffiliation: event.target.value })
                  }
                  placeholder="Their institution"
                  value={author.externalAffiliation ?? ""}
                />
              </>
            )}
            <div className={styles.checkRow}>
              <input
                checked={author.corresponding}
                id={`${fieldId}-corresponding-${index}`}
                onChange={(event) =>
                  update(index, { corresponding: event.target.checked })
                }
                type="checkbox"
              />
              <label htmlFor={`${fieldId}-corresponding-${index}`}>
                Corresponding author
              </label>
              <input
                name="authors.corresponding"
                type="hidden"
                value={author.corresponding ? "yes" : "no"}
              />
            </div>
            <div className={styles.checkRow}>
              <input
                checked={author.equalContribution}
                id={`${fieldId}-equal-${index}`}
                onChange={(event) =>
                  update(index, { equalContribution: event.target.checked })
                }
                type="checkbox"
              />
              <label htmlFor={`${fieldId}-equal-${index}`}>
                Contributed equally
              </label>
              <input
                name="authors.equalContribution"
                type="hidden"
                value={author.equalContribution ? "yes" : "no"}
              />
            </div>
          </div>
        ))}
        <button
          className={styles.textButton}
          disabled={authors.length >= MAX_AUTHORS}
          onClick={() => setAuthors((current) => [...current, emptyAuthor])}
          type="button"
        >
          Add another author
        </button>
        {authors.length > 1 ? (
          <button
            className={styles.textButton}
            onClick={() => setAuthors((current) => current.slice(0, -1))}
            type="button"
          >
            Remove the last one
          </button>
        ) : null}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-doi`}>DOI</label>
        <input defaultValue={values.doi} id={`${fieldId}-doi`} name="doi" />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-arxiv`}>arXiv id</label>
        <input
          defaultValue={values.arxivId}
          id={`${fieldId}-arxiv`}
          name="arxivId"
        />
      </div>

      {(
        [
          ["pdfUrl", "Paper (PDF)"],
          ["codeUrl", "Code"],
          ["datasetUrl", "Dataset"],
          ["pageUrl", "Project page"],
        ] as const
      ).map(([name, label]) => (
        <div className={styles.field} key={name}>
          <label htmlFor={`${fieldId}-${name}`}>{label}</label>
          <input
            defaultValue={values[name]}
            id={`${fieldId}-${name}`}
            name={name}
            placeholder="https://"
            type="url"
          />
        </div>
      ))}

      <SubmitButton pending="Saving…">
        {values.id ? "Save changes" : "Record it"}
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
