import "server-only";

import {
  addMilestoneAction,
  removeMilestoneAction,
} from "@/app/admin/milestones/actions";
import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { can } from "@/lib/permissions";

import styles from "./Admin.module.css";
import { ActionForm, SubmitButton } from "./AdminForms";
import { OnPageBar } from "./OnPageBar";

/**
 * The About page's timeline, kept from the page itself. Drawn only for
 * someone who may manage settings; the actions check again. The rest of the
 * page is written in the code.
 * ponytail: an entry is added or removed, not edited; add an edit form if
 * correcting one by removing and re-adding it becomes a nuisance.
 */
export async function AboutOnPage() {
  const viewer = await getViewer();
  if (
    !viewer ||
    !can(viewer.role, "settings:manage") ||
    !isDatabaseConfigured()
  ) {
    return null;
  }
  const milestones = await getDb().milestone.findMany({
    orderBy: { date: "asc" },
    select: { id: true, date: true, title: true },
  });

  return (
    <OnPageBar
      actions={[
        {
          label: "Add to the timeline",
          editor: (
            <ActionForm action={addMilestoneAction}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="milestone-date">Date</label>
                  <input
                    id="milestone-date"
                    name="date"
                    type="date"
                    required
                    aria-describedby="milestone-date-hint"
                  />
                  <p id="milestone-date-hint" className={styles.hint}>
                    The timeline shows the year and lists entries in date order.
                  </p>
                </div>
                <div className={styles.field}>
                  <label htmlFor="milestone-title">What happened</label>
                  <input
                    id="milestone-title"
                    name="title"
                    maxLength={160}
                    required
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="milestone-body">A sentence more</label>
                <textarea
                  id="milestone-body"
                  name="body"
                  rows={3}
                  maxLength={600}
                  aria-describedby="milestone-body-hint"
                />
                <p id="milestone-body-hint" className={styles.hint}>
                  Optional.
                </p>
              </div>
              <SubmitButton pending="Adding…">Add to the timeline</SubmitButton>
            </ActionForm>
          ),
          adding: true,
          own: "",
        },
        ...(milestones.length > 0
          ? [
              {
                label: "Remove from the timeline",
                editor: (
                  <ul className={styles.rows}>
                    {milestones.map((milestone) => (
                      <li key={milestone.id}>
                        <span>
                          {milestone.date.getUTCFullYear()} · {milestone.title}
                        </span>
                        <ActionForm
                          action={removeMilestoneAction}
                          className={styles.inlineForm}
                        >
                          <input
                            type="hidden"
                            name="milestoneId"
                            value={milestone.id}
                          />
                          <SubmitButton
                            tone="danger"
                            pending="Removing…"
                            label={`Remove ${milestone.title}`}
                          >
                            Remove
                          </SubmitButton>
                        </ActionForm>
                      </li>
                    ))}
                  </ul>
                ),
                adding: false,
                own: "",
              },
            ]
          : []),
      ]}
    />
  );
}
