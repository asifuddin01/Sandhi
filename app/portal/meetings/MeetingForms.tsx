"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/portal/Portal.module.css";
import { toDhakaInput } from "@/lib/dhaka-time";
import {
  MAX_MEETING_LINK,
  MAX_MEETING_TEXT,
  MAX_MEETING_TITLE,
} from "@/lib/portal/meeting-limits";
import type { MemberMeeting } from "@/lib/portal/meetings";

import {
  createMeetingAction,
  deleteMeetingAction,
  updateMeetingAction,
} from "./actions";

export interface ProjectOption {
  id: string;
  title: string;
}

export interface TeamOption {
  memberId: string;
  name: string;
}

/** Times are entered in the lab's own clock, as everywhere else in admin. */
function Times({ meeting }: { meeting?: MemberMeeting }) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="meeting-start">Starts (Dhaka time)</label>
        <input
          defaultValue={meeting ? toDhakaInput(meeting.startsAt) : ""}
          id="meeting-start"
          name="startsAt"
          required
          type="datetime-local"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="meeting-end">Ends (optional)</label>
        <input
          defaultValue={meeting ? toDhakaInput(meeting.endsAt) : ""}
          id="meeting-end"
          name="endsAt"
          type="datetime-local"
        />
        <p className={styles.hint}>Left empty, a calendar gives it an hour.</p>
      </div>
    </>
  );
}

/**
 * Calling a meeting. Who is expected is set afterwards, on the meeting's own
 * page, where the project is already settled and its team is known.
 */
export function CallMeeting({
  projects,
  canCallLabWide,
}: {
  projects: ProjectOption[];
  canCallLabWide: boolean;
}) {
  return (
    <ActionForm
      action={createMeetingAction}
      className={styles.form}
      resetOnSuccess
    >
      <div className={styles.field}>
        <label htmlFor="meeting-title">What the meeting is</label>
        <input
          id="meeting-title"
          maxLength={MAX_MEETING_TITLE}
          name="title"
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="meeting-project">About</label>
        <select id="meeting-project" name="projectId">
          {canCallLabWide ? <option value="">The whole lab</option> : null}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </div>

      <Times />

      <div className={styles.field}>
        <label htmlFor="meeting-link">Joining link (optional)</label>
        <input
          id="meeting-link"
          maxLength={MAX_MEETING_LINK}
          name="link"
          placeholder="https://"
          type="url"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="meeting-agenda">Agenda (optional)</label>
        <textarea
          id="meeting-agenda"
          maxLength={MAX_MEETING_TEXT}
          name="agenda"
          rows={4}
        />
        <p className={styles.hint}>Markdown. A list of points is plenty.</p>
      </div>

      <div className={styles.submit}>
        <SubmitButton pending="Calling…">Call the meeting</SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * Changing a meeting, and writing up what happened in it. The notes are the
 * reason the page exists after the day has passed.
 */
export function EditMeeting({
  meeting,
  team,
}: {
  meeting: MemberMeeting;
  team: TeamOption[];
}) {
  const expected = new Set(meeting.attendees.map((person) => person.id));

  return (
    <ActionForm action={updateMeetingAction} className={styles.form}>
      <input type="hidden" name="meetingId" value={meeting.id} />

      <div className={styles.field}>
        <label htmlFor="meeting-title">What the meeting is</label>
        <input
          defaultValue={meeting.title}
          id="meeting-title"
          maxLength={MAX_MEETING_TITLE}
          name="title"
          required
        />
      </div>

      <Times meeting={meeting} />

      <div className={styles.field}>
        <label htmlFor="meeting-link">Joining link (optional)</label>
        <input
          defaultValue={meeting.link ?? ""}
          id="meeting-link"
          maxLength={MAX_MEETING_LINK}
          name="link"
          placeholder="https://"
          type="url"
        />
      </div>

      {team.length > 0 ? (
        <fieldset className={styles.who}>
          <legend className={styles.label}>Expected</legend>
          {team.map((person) => (
            <div className={styles.checkRow} key={person.memberId}>
              <input
                defaultChecked={expected.has(person.memberId)}
                id={`expected-${person.memberId}`}
                name="attendeeId"
                type="checkbox"
                value={person.memberId}
              />
              <label htmlFor={`expected-${person.memberId}`}>
                {person.name}
              </label>
            </div>
          ))}
        </fieldset>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="meeting-agenda">Agenda</label>
        <textarea
          defaultValue={meeting.agenda ?? ""}
          id="meeting-agenda"
          maxLength={MAX_MEETING_TEXT}
          name="agenda"
          rows={4}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="meeting-notes">Write up what happened</label>
        <textarea
          defaultValue={meeting.notes ?? ""}
          id="meeting-notes"
          maxLength={MAX_MEETING_TEXT}
          name="notes"
          rows={8}
        />
        <p className={styles.hint}>
          Markdown. What was decided, and who is doing what.
        </p>
      </div>

      <div className={styles.submit}>
        <SubmitButton pending="Saving…">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CallOff({ meetingId }: { meetingId: string }) {
  return (
    <ActionForm action={deleteMeetingAction} className={styles.inlineForm}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <SubmitButton pending="Calling off…" tone="danger">
        Call this meeting off
      </SubmitButton>
    </ActionForm>
  );
}
