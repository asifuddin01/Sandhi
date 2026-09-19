"use client";

import { useState } from "react";

import styles from "./Admin.module.css";

export type AuthorRowValue = {
  memberId: string | null;
  externalName: string | null;
  externalAffiliation: string | null;
  equalContribution: boolean;
  corresponding: boolean;
};

/**
 * The author list, in order. Author order is part of the claim a paper makes,
 * so it is moved with buttons rather than only by dragging: a pointer is not
 * the only way people use this form.
 *
 * Every row submits all five fields, and the flags are selects rather than
 * checkboxes, because an unticked checkbox is left out of the submission and
 * would misalign the rows against each other.
 */
export function AuthorsField({
  members,
  defaultRows,
}: {
  members: ReadonlyArray<{ id: string; name: string }>;
  defaultRows: AuthorRowValue[];
}) {
  const [rows, setRows] = useState(() =>
    defaultRows.map((row, index) => ({ ...row, key: index })),
  );
  const [nextKey, setNextKey] = useState(defaultRows.length);

  const move = (index: number, by: -1 | 1) =>
    setRows((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  return (
    <fieldset className={styles.fieldset}>
      <legend>Authors</legend>
      <p className={styles.hint}>
        In the order they appear on the paper. Choose a member, or type a name
        for someone outside the lab — not both.
      </p>
      {rows.length === 0 ? (
        <p className={styles.hint}>No authors yet.</p>
      ) : null}

      {rows.map((row, index) => (
        <div className={styles.authorRow} key={row.key}>
          <div className={styles.field}>
            <label htmlFor={`author-member-${row.key}`}>
              Author {index + 1}
            </label>
            <select
              id={`author-member-${row.key}`}
              name="authors.memberId"
              defaultValue={row.memberId ?? ""}
            >
              <option value="">Not a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`author-name-${row.key}`}>Name</label>
            <input
              id={`author-name-${row.key}`}
              name="authors.externalName"
              maxLength={200}
              defaultValue={row.externalName ?? ""}
              placeholder="Outside the lab"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`author-affiliation-${row.key}`}>Affiliation</label>
            <input
              id={`author-affiliation-${row.key}`}
              name="authors.externalAffiliation"
              maxLength={200}
              defaultValue={row.externalAffiliation ?? ""}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`author-equal-${row.key}`}>Equal</label>
            <select
              id={`author-equal-${row.key}`}
              name="authors.equalContribution"
              defaultValue={row.equalContribution ? "yes" : "no"}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`author-corresponding-${row.key}`}>
              Corresponding
            </label>
            <select
              id={`author-corresponding-${row.key}`}
              name="authors.corresponding"
              defaultValue={row.corresponding ? "yes" : "no"}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className={styles.rowActions}>
            <button
              className={styles.quietButton}
              type="button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              Up<span className="visually-hidden">: author {index + 1}</span>
            </button>
            <button
              className={styles.quietButton}
              type="button"
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              Down<span className="visually-hidden">: author {index + 1}</span>
            </button>
            <button
              className={styles.quietButton}
              type="button"
              onClick={() =>
                setRows((current) =>
                  current.filter((candidate) => candidate.key !== row.key),
                )
              }
            >
              Remove
              <span className="visually-hidden"> author {index + 1}</span>
            </button>
          </div>
        </div>
      ))}

      <p>
        <button
          className={styles.quietButton}
          type="button"
          onClick={() => {
            setRows((current) => [
              ...current,
              {
                memberId: null,
                externalName: null,
                externalAffiliation: null,
                equalContribution: false,
                corresponding: false,
                key: nextKey,
              },
            ]);
            setNextKey(nextKey + 1);
          }}
        >
          Add an author
        </button>
      </p>
    </fieldset>
  );
}
