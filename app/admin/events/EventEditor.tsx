import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  MarkdownField,
  TitleSlugFields,
} from "@/components/admin/ContentFields";
import type { getEventForEdit } from "@/lib/admin/events";
import { EVENT_KINDS } from "@/lib/admin/events";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { toDhakaInput } from "@/lib/dhaka-time";
import { humanizeEnum } from "@/lib/public-content";

import { saveEventAction } from "./actions";

type EventRecord = NonNullable<Awaited<ReturnType<typeof getEventForEdit>>>;

export function EventEditor({ event }: { event?: EventRecord }) {
  return (
    <ActionForm action={saveEventAction}>
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <TitleSlugFields
        defaultTitle={event?.title}
        defaultSlug={event?.slug}
        pathPrefix="/events/"
      />
      <MarkdownField
        id="abstract"
        name="abstract"
        label="Description"
        defaultValue={event?.abstract}
        rows={10}
      />
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="kind">Kind</label>
          <select id="kind" name="kind" defaultValue={event?.kind ?? "SEMINAR"}>
            {EVENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {humanizeEnum(kind)}
              </option>
            ))}
          </select>
          <p className={styles.hint}>
            Internal events never appear on the site.
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor="startsAt">Starts (Dhaka)</label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={toDhakaInput(event?.startsAt)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="endsAt">Ends (Dhaka)</label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={toDhakaInput(event?.endsAt)}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="speakers">Speakers</label>
        <textarea
          id="speakers"
          name="speakers"
          rows={3}
          defaultValue={event?.speakers.join("\n")}
          aria-describedby="speakers-hint"
        />
        <p id="speakers-hint" className={styles.hint}>
          One per line.
        </p>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            maxLength={200}
            defaultValue={event?.location ?? ""}
          />
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="isOnline"
            defaultChecked={event?.isOnline ?? true}
          />
          <span>Held online</span>
        </label>
      </div>
      <fieldset className={styles.fieldset}>
        <legend>Registration</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="allowRegistration"
            defaultChecked={event?.allowRegistration ?? false}
          />
          <span>Let people register on this site</span>
        </label>
        <div className={styles.field}>
          <label htmlFor="registerUrl">Or an external registration link</label>
          <input
            id="registerUrl"
            name="registerUrl"
            type="url"
            placeholder="https://"
            defaultValue={event?.registerUrl ?? ""}
          />
        </div>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>After the event</legend>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="recordingUrl">Recording link</label>
            <input
              id="recordingUrl"
              name="recordingUrl"
              type="url"
              placeholder="https://"
              defaultValue={event?.recordingUrl ?? ""}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="slidesUrl">Slides link</label>
            <input
              id="slidesUrl"
              name="slidesUrl"
              type="url"
              placeholder="https://"
              defaultValue={event?.slidesUrl ?? ""}
            />
          </div>
        </div>
      </fieldset>
      <div className={styles.field}>
        <label htmlFor="state">State</label>
        <select id="state" name="state" defaultValue={event?.state ?? "DRAFT"}>
          {unscheduledStates.map((state) => (
            <option key={state} value={state}>
              {publishStateLabels[state]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pending="Saving…">
        {event ? "Save changes" : "Create event"}
      </SubmitButton>
    </ActionForm>
  );
}
