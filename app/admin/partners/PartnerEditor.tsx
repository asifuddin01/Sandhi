import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import type { getPartnerForEdit } from "@/lib/admin/partners";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { PARTNER_KINDS } from "@/lib/partner-content";
import { humanizeEnum } from "@/lib/public-content";

import { savePartnerAction } from "./actions";

type PartnerRecord = NonNullable<Awaited<ReturnType<typeof getPartnerForEdit>>>;

export function PartnerEditor({ partner }: { partner?: PartnerRecord }) {
  return (
    <ActionForm action={savePartnerAction}>
      {partner ? <input type="hidden" name="id" value={partner.id} /> : null}
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            maxLength={200}
            defaultValue={partner?.name}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="kind">Kind</label>
          <select
            id="kind"
            name="kind"
            defaultValue={partner?.kind ?? "UNIVERSITY"}
          >
            {PARTNER_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {humanizeEnum(kind)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={600}
          defaultValue={partner?.description}
          required
        />
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="relationship">Relationship</label>
          <input
            id="relationship"
            name="relationship"
            maxLength={200}
            placeholder="Joint work on multilingual benchmarks"
            defaultValue={partner?.relationship ?? ""}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="url">Website</label>
          <input
            id="url"
            name="url"
            type="url"
            placeholder="https://"
            defaultValue={partner?.url ?? ""}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="sortOrder">Order</label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            step={1}
            defaultValue={partner?.sortOrder ?? 0}
            aria-describedby="sortOrder-hint"
          />
          <p id="sortOrder-hint" className={styles.hint}>
            Lower numbers appear first.
          </p>
        </div>
      </div>
      {partner?.logoKey ? (
        <p className={styles.hint}>
          This partner has a logo; it is kept as is.
        </p>
      ) : null}
      <div className={styles.field}>
        <label htmlFor="state">State</label>
        <select
          id="state"
          name="state"
          defaultValue={partner?.state ?? "DRAFT"}
        >
          {unscheduledStates.map((state) => (
            <option key={state} value={state}>
              {publishStateLabels[state]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pending="Saving…">
        {partner ? "Save changes" : "Add partner"}
      </SubmitButton>
    </ActionForm>
  );
}
