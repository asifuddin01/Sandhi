"use client";

import { useState } from "react";

import styles from "./Admin.module.css";

export type TeamRow = { memberId: string; role: string; isLead: boolean };

/**
 * The people on a project, in order. Every row submits all three fields
 * (the lead flag is a select, not a checkbox, since unticked checkboxes are
 * left out of the form and would misalign the rows).
 */
export function TeamField({
  members,
  defaultRows,
}: {
  members: ReadonlyArray<{ id: string; name: string }>;
  defaultRows: TeamRow[];
}) {
  const [rows, setRows] = useState<Array<TeamRow & { key: number }>>(
    defaultRows.map((row, index) => ({ ...row, key: index })),
  );
  const [nextKey, setNextKey] = useState(defaultRows.length);

  return (
    <fieldset className={styles.fieldset}>
      <legend>Team</legend>
      {rows.length === 0 ? (
        <p className={styles.hint}>No one on this project yet.</p>
      ) : null}
      {rows.map((row, index) => (
        <div className={styles.fieldRow} key={row.key}>
          <div className={styles.field}>
            <label htmlFor={`team-member-${row.key}`}>Person {index + 1}</label>
            <select
              id={`team-member-${row.key}`}
              name="team.memberId"
              defaultValue={row.memberId}
              required
            >
              <option value="" disabled>
                Choose a member
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`team-role-${row.key}`}>Role</label>
            <input
              id={`team-role-${row.key}`}
              name="team.role"
              maxLength={80}
              placeholder="Researcher"
              defaultValue={row.role}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`team-lead-${row.key}`}>Leads the project</label>
            <select
              id={`team-lead-${row.key}`}
              name="team.isLead"
              defaultValue={row.isLead ? "yes" : "no"}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <button
            className={styles.quietButton}
            type="button"
            onClick={() =>
              setRows((current) =>
                current.filter((candidate) => candidate.key !== row.key),
              )
            }
          >
            Remove<span className="visually-hidden"> person {index + 1}</span>
          </button>
        </div>
      ))}
      <p>
        <button
          className={styles.quietButton}
          type="button"
          onClick={() => {
            setRows((current) => [
              ...current,
              { memberId: "", role: "", isLead: false, key: nextKey },
            ]);
            setNextKey(nextKey + 1);
          }}
        >
          Add a person
        </button>
      </p>
    </fieldset>
  );
}
