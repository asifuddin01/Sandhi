"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/portal/Portal.module.css";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from "@/lib/portal/progress-limits";

import { setTaskStatusAction } from "../projects/tasks";

/**
 * Moving one's own task along, from the list of everything one owes. The
 * action is the project board's — the rule about who may move a task lives
 * there, and there is no second copy of it here to drift.
 */
export function TaskState({
  slug,
  taskId,
  status,
}: {
  slug: string;
  taskId: string;
  status: string;
}) {
  return (
    <ActionForm action={setTaskStatusAction} className={styles.inlineForm}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="taskId" value={taskId} />
      <label className={styles.inlineLabel} htmlFor={`state-${taskId}`}>
        State
      </label>
      <select id={`state-${taskId}`} name="status" defaultValue={status}>
        {TASK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {TASK_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      <SubmitButton tone="quiet" pending="Saving…">
        Set
      </SubmitButton>
    </ActionForm>
  );
}
