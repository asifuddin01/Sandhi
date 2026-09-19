import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  MarkdownField,
  TitleSlugFields,
} from "@/components/admin/ContentFields";
import type {
  getOpportunityForEdit,
  getResearchAreaOptions,
} from "@/lib/admin/opportunities";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { toDhakaInput } from "@/lib/dhaka-time";
import {
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_KINDS,
} from "@/lib/public-opportunities";

import { saveOpportunityAction } from "./actions";

type Opportunity = NonNullable<
  Awaited<ReturnType<typeof getOpportunityForEdit>>
>;
type Areas = Awaited<ReturnType<typeof getResearchAreaOptions>>;

export function OpportunityEditor({
  opportunity,
  areas,
}: {
  opportunity?: Opportunity;
  areas: Areas;
}) {
  const chosen = new Set(opportunity?.areaSlugs ?? []);
  return (
    <ActionForm action={saveOpportunityAction}>
      {opportunity ? (
        <input type="hidden" name="id" value={opportunity.id} />
      ) : null}
      <TitleSlugFields
        defaultTitle={opportunity?.title}
        defaultSlug={opportunity?.slug}
        pathPrefix="/opportunities/"
      />
      <MarkdownField
        id="description"
        name="description"
        label="Description"
        defaultValue={opportunity?.description}
        rows={10}
      />
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="responsibilities">Responsibilities</label>
          <textarea
            id="responsibilities"
            name="responsibilities"
            rows={5}
            defaultValue={opportunity?.responsibilities.join("\n")}
            aria-describedby="responsibilities-hint"
          />
          <p id="responsibilities-hint" className={styles.hint}>
            One per line.
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor="requirements">Requirements</label>
          <textarea
            id="requirements"
            name="requirements"
            rows={5}
            defaultValue={opportunity?.requirements.join("\n")}
            aria-describedby="requirements-hint"
          />
          <p id="requirements-hint" className={styles.hint}>
            One per line.
          </p>
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="kind">Kind</label>
          <select
            id="kind"
            name="kind"
            defaultValue={opportunity?.kind ?? "RESEARCH_POSITION"}
          >
            {OPPORTUNITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {OPPORTUNITY_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="deadline">Deadline (Dhaka)</label>
          <input
            id="deadline"
            name="deadline"
            type="datetime-local"
            defaultValue={toDhakaInput(opportunity?.deadline)}
            aria-describedby="deadline-hint"
          />
          <p id="deadline-hint" className={styles.hint}>
            Leaves the site on its own after this time. Empty means open until
            archived.
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor="duration">Duration</label>
          <input
            id="duration"
            name="duration"
            maxLength={120}
            placeholder="Six months"
            defaultValue={opportunity?.duration ?? ""}
          />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            maxLength={200}
            defaultValue={opportunity?.location ?? ""}
          />
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="isRemote"
            defaultChecked={opportunity?.isRemote ?? true}
          />
          <span>Remote work possible</span>
        </label>
      </div>
      <fieldset className={styles.fieldset}>
        <legend>Research areas</legend>
        {areas.length === 0 ? (
          <p className={styles.hint}>No research areas yet.</p>
        ) : (
          areas.map((area) => (
            <label className={styles.check} key={area.slug}>
              <input
                type="checkbox"
                name="areaSlugs"
                value={area.slug}
                defaultChecked={chosen.has(area.slug)}
              />
              <span>{area.name}</span>
            </label>
          ))
        )}
      </fieldset>
      <div className={styles.field}>
        <label htmlFor="state">State</label>
        <select
          id="state"
          name="state"
          defaultValue={opportunity?.state ?? "DRAFT"}
        >
          {unscheduledStates.map((state) => (
            <option key={state} value={state}>
              {publishStateLabels[state]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pending="Saving…">
        {opportunity ? "Save changes" : "Create opportunity"}
      </SubmitButton>
    </ActionForm>
  );
}
