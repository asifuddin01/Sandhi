import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import {
  getDecidedProfileChanges,
  getPendingProfileChanges,
} from "@/lib/admin/approvals";
import { requireCapability } from "@/lib/authz";
import {
  APPROVAL_FIELD_LABELS,
  describeFieldValue,
} from "@/lib/portal/profile-fields";

import { ProfileDecision } from "./DecisionForms";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  await requireCapability("approvals:manage", "/admin/approvals");
  const [people, decided] = await Promise.all([
    getPendingProfileChanges(),
    getDecidedProfileChanges(),
  ]);

  return (
    <>
      <header className={styles.header}>
        <h1>Approvals</h1>
        <p>
          Changes members have asked for on their published profiles. Until one
          is allowed, the site goes on showing what it showed before.
        </p>
      </header>

      {people.length === 0 ? (
        <p className={styles.empty}>Nothing is waiting.</p>
      ) : (
        people.map((person) => (
          <section
            aria-label={`${person.memberName}'s profile`}
            className={styles.section}
            key={person.memberId}
          >
            <h2>
              <Link href={`/people/${person.memberSlug}`}>
                {person.memberName}
              </Link>
            </h2>
            <p className={styles.hint}>
              Asked on{" "}
              <time dateTime={person.asked.toISOString()}>
                {formatAdminTime(person.asked)}
              </time>
              .
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="visually-hidden">
                  What {person.memberName} would change
                </caption>
                <thead>
                  <tr>
                    <th scope="col">What</th>
                    <th scope="col">Now</th>
                    <th scope="col">Would become</th>
                  </tr>
                </thead>
                <tbody>
                  {person.changes.map((change) => (
                    <tr key={change.id}>
                      <th scope="row">{APPROVAL_FIELD_LABELS[change.field]}</th>
                      <td>
                        {describeFieldValue(change.field, change.oldValue)}
                      </td>
                      <td>
                        {describeFieldValue(change.field, change.newValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ProfileDecision
              memberId={person.memberId}
              name={person.memberName}
            />
          </section>
        ))
      )}

      {decided.length > 0 ? (
        <section className={styles.section} aria-labelledby="decided">
          <h2 id="decided">Decided in the last day</h2>
          <ul className={styles.noteList}>
            {decided.map((decision) => (
              <li
                key={`${decision.memberSlug}-${decision.decidedAt.toISOString()}`}
              >
                <span>
                  <Link href={`/people/${decision.memberSlug}`}>
                    {decision.memberName}
                  </Link>
                  {decision.approved ? " — applied" : " — refused"}
                </span>
                <span className={styles.hint}>
                  {decision.fields
                    .map((field) => APPROVAL_FIELD_LABELS[field])
                    .join(", ")}
                  {decision.reviewer ? ` · by ${decision.reviewer}` : ""} ·{" "}
                  <time dateTime={decision.decidedAt.toISOString()}>
                    {formatAdminTime(decision.decidedAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
