import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  MarkdownField,
  TitleSlugFields,
} from "@/components/admin/ContentFields";
import type {
  getAreaForEdit,
  getThemeForEdit,
  getThemeOptions,
} from "@/lib/admin/research";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";

import { saveAreaAction, saveThemeAction } from "./actions";

type Theme = NonNullable<Awaited<ReturnType<typeof getThemeForEdit>>>;
type Area = NonNullable<Awaited<ReturnType<typeof getAreaForEdit>>>;
type ThemeOptions = Awaited<ReturnType<typeof getThemeOptions>>;

function OrderAndState({
  sortOrder,
  state,
}: {
  sortOrder?: number;
  state?: string;
}) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.field}>
        <label htmlFor="sortOrder">Order</label>
        <input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          max={999}
          step={1}
          defaultValue={sortOrder ?? 0}
          aria-describedby="sortOrder-hint"
        />
        <p id="sortOrder-hint" className={styles.hint}>
          Lower numbers appear first.
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="state">State</label>
        <select id="state" name="state" defaultValue={state ?? "DRAFT"}>
          {unscheduledStates.map((value) => (
            <option key={value} value={value}>
              {publishStateLabels[value]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ThemeEditor({ theme }: { theme?: Theme }) {
  return (
    <ActionForm action={saveThemeAction}>
      {theme ? <input type="hidden" name="id" value={theme.id} /> : null}
      <TitleSlugFields
        titleLabel="Name"
        defaultTitle={theme?.name}
        defaultSlug={theme?.slug}
        pathPrefix="/research/"
      />
      <div className={styles.field}>
        <label htmlFor="gloss">Short description</label>
        <input
          id="gloss"
          name="gloss"
          maxLength={300}
          defaultValue={theme?.gloss}
          required
        />
      </div>
      <MarkdownField
        id="overview"
        name="overview"
        label="Overview"
        defaultValue={theme?.overview ?? ""}
        rows={10}
        hint="Optional. Markdown."
      />
      <OrderAndState sortOrder={theme?.sortOrder} state={theme?.state} />
      <SubmitButton pending="Saving…">
        {theme ? "Save changes" : "Create theme"}
      </SubmitButton>
    </ActionForm>
  );
}

export function AreaEditor({
  area,
  themes,
}: {
  area?: Area;
  themes: ThemeOptions;
}) {
  return (
    <ActionForm action={saveAreaAction}>
      {area ? <input type="hidden" name="id" value={area.id} /> : null}
      <TitleSlugFields
        titleLabel="Name"
        defaultTitle={area?.name}
        defaultSlug={area?.slug}
        pathPrefix="/research/areas/"
      />
      <div className={styles.field}>
        <label htmlFor="themeId">Theme</label>
        <select
          id="themeId"
          name="themeId"
          defaultValue={area?.themeId ?? ""}
          required
        >
          <option value="" disabled>
            Choose a theme
          </option>
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="summary">Summary</label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          maxLength={500}
          defaultValue={area?.summary}
          required
        />
      </div>
      <MarkdownField
        id="overview"
        name="overview"
        label="Overview"
        defaultValue={area?.overview ?? ""}
        rows={10}
        hint="Optional. Markdown."
      />
      <div className={styles.field}>
        <label htmlFor="questions">Open questions</label>
        <textarea
          id="questions"
          name="questions"
          rows={4}
          defaultValue={area?.questions.join("\n")}
          aria-describedby="questions-hint"
        />
        <p id="questions-hint" className={styles.hint}>
          One per line.
        </p>
      </div>
      <OrderAndState sortOrder={area?.sortOrder} state={area?.state} />
      <SubmitButton pending="Saving…">
        {area ? "Save changes" : "Create area"}
      </SubmitButton>
    </ActionForm>
  );
}
