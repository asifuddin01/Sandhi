"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/admin/Admin.module.css";
import {
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_TITLE,
} from "@/lib/announcements";

import {
  deleteAnnouncementAction,
  postAnnouncementAction,
  setAnnouncementPinnedAction,
} from "./actions";

export function PostAnnouncement() {
  return (
    <ActionForm
      action={postAnnouncementAction}
      className={styles.actionForm}
      resetOnSuccess
    >
      <div className={styles.field}>
        <label htmlFor="announcement-title">Title</label>
        <input
          id="announcement-title"
          maxLength={MAX_ANNOUNCEMENT_TITLE}
          name="title"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="announcement-body">What people need to know</label>
        <textarea
          id="announcement-body"
          maxLength={MAX_ANNOUNCEMENT_BODY}
          name="body"
          rows={5}
          required
        />
        <p className={styles.hint}>
          Markdown, so a deadline can carry a link. Everyone in the lab sees
          this in the News section; nobody outside it does.
        </p>
      </div>
      <div className={styles.checkRow}>
        <input id="announcement-pinned" name="pinned" type="checkbox" />
        <label htmlFor="announcement-pinned">
          Pin it to the top until it is taken down
        </label>
      </div>
      <SubmitButton pending="Posting…">Post announcement</SubmitButton>
    </ActionForm>
  );
}

export function AnnouncementControls({
  id,
  pinned,
}: {
  id: string;
  pinned: boolean;
}) {
  return (
    <div className={styles.fieldRow}>
      <ActionForm action={setAnnouncementPinnedAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="pinned" value={pinned ? "no" : "yes"} />
        <SubmitButton tone="quiet" pending="Saving…">
          {pinned ? "Unpin" : "Pin"}
        </SubmitButton>
      </ActionForm>
      <ActionForm action={deleteAnnouncementAction}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton tone="danger" pending="Removing…">
          Take down
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
