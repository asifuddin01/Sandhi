"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/portal/Portal.module.css";
import {
  MAX_UPDATE_BODY,
  MAX_UPDATE_NEXT,
  MAX_UPDATE_TITLE,
} from "@/lib/portal/progress-limits";

import {
  deleteProjectUpdateAction,
  postProjectUpdateAction,
  setUpdateVisibilityAction,
} from "../actions";

export function PostUpdate({ slug }: { slug: string }) {
  return (
    <ActionForm
      action={postProjectUpdateAction}
      className={styles.form}
      resetOnSuccess
    >
      <input type="hidden" name="slug" value={slug} />
      <div className={styles.field}>
        <label htmlFor="update-title">Heading</label>
        <input
          id="update-title"
          name="title"
          maxLength={MAX_UPDATE_TITLE}
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="update-body">What happened</label>
        <textarea
          id="update-body"
          name="body"
          rows={6}
          maxLength={MAX_UPDATE_BODY}
          required
          aria-describedby="update-body-hint"
        />
        <p className={styles.hint} id="update-body-hint">
          Markdown, with $maths$ and code blocks.
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="update-next">What comes next</label>
        <textarea
          id="update-next"
          name="nextUp"
          rows={2}
          maxLength={MAX_UPDATE_NEXT}
        />
      </div>
      <SubmitButton pending="Posting…">Post update</SubmitButton>
    </ActionForm>
  );
}

/**
 * Publishing and withdrawing are their own buttons, separate from writing.
 * An update reaches the public page only when someone chooses that, and only
 * once the project itself is public.
 */
export function UpdateControls({
  slug,
  id,
  isPublic,
  projectIsPublic,
}: {
  slug: string;
  id: string;
  isPublic: boolean;
  projectIsPublic: boolean;
}) {
  return (
    <div className={styles.updateControls}>
      <ActionForm
        action={setUpdateVisibilityAction}
        className={styles.inlineForm}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="isPublic" value={isPublic ? "no" : "yes"} />
        <SubmitButton tone="quiet" pending="Saving…">
          {isPublic ? "Make internal" : "Publish this update"}
        </SubmitButton>
      </ActionForm>
      <ActionForm
        action={deleteProjectUpdateAction}
        className={styles.inlineForm}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={id} />
        <SubmitButton tone="quiet" pending="Deleting…">
          Delete
        </SubmitButton>
      </ActionForm>
      {!projectIsPublic && !isPublic ? (
        <p className={styles.hint}>
          Publish it now and it appears once the project itself is published.
        </p>
      ) : null}
    </div>
  );
}
