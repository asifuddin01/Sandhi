"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/public/ResearchPages.module.css";
import {
  setMemberAreaAction,
  setMemberRankAction,
} from "@/app/admin/members/actions";
import { memberRanks, rankLabels } from "@/lib/member-rank";

export interface AreaChoice {
  slug: string;
  name: string;
}

/**
 * What an administrator can change about someone while looking at their
 * profile: what they are called, and which research they are on. Naming a
 * research lead is a decision made about a person, so it belongs on the
 * person's page rather than in a list of rows in administration.
 *
 * It is drawn only for someone who may make these changes, and the server
 * checks the same capability again on every action.
 */
export function MemberAdminBar({
  slug,
  name,
  rank,
  areas,
  allAreas,
}: {
  slug: string;
  name: string;
  rank: string;
  areas: Array<{ slug: string; name: string; isLead: boolean }>;
  allAreas: AreaChoice[];
}) {
  const unassigned = allAreas.filter(
    (area) => !areas.some((held) => held.slug === area.slug),
  );

  return (
    <aside className={styles.adminBar} aria-label={`Manage ${name}`}>
      <p className={styles.adminBarTitle}>Administration</p>

      <ActionForm action={setMemberRankAction} className={styles.adminRow}>
        <input type="hidden" name="slug" value={slug} />
        <label htmlFor="member-rank">Standing</label>
        <select id="member-rank" name="rank" defaultValue={rank}>
          {memberRanks.map((value) => (
            <option key={value} value={value}>
              {rankLabels[value]}
            </option>
          ))}
        </select>
        <SubmitButton tone="quiet" pending="Saving…">
          Save standing
        </SubmitButton>
      </ActionForm>

      {unassigned.length > 0 ? (
        <ActionForm action={setMemberAreaAction} className={styles.adminRow}>
          <input type="hidden" name="slug" value={slug} />
          <label htmlFor="member-area">Add to research</label>
          <select id="member-area" name="areaSlug" defaultValue="">
            {unassigned.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.name}
              </option>
            ))}
          </select>
          <label className={styles.adminCheck}>
            <input type="checkbox" name="isLead" value="yes" />
            as lead
          </label>
          <SubmitButton tone="quiet" pending="Assigning…">
            Assign
          </SubmitButton>
        </ActionForm>
      ) : null}

      {areas.length > 0 ? (
        <ul className={styles.adminList}>
          {areas.map((area) => (
            <li key={area.slug}>
              <span>
                {area.name}
                {area.isLead ? " · lead" : ""}
              </span>
              <ActionForm
                action={setMemberAreaAction}
                className={styles.adminRow}
              >
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="areaSlug" value={area.slug} />
                <input
                  type="hidden"
                  name="isLead"
                  value={area.isLead ? "no" : "yes"}
                />
                <SubmitButton tone="quiet" pending="Saving…">
                  {area.isLead ? "Not lead" : "Make lead"}
                </SubmitButton>
              </ActionForm>
              <ActionForm
                action={setMemberAreaAction}
                className={styles.adminRow}
              >
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="areaSlug" value={area.slug} />
                <input type="hidden" name="remove" value="yes" />
                <SubmitButton tone="quiet" pending="Removing…">
                  Remove
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
