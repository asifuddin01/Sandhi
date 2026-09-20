"use client";

import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import styles from "@/components/portal/Portal.module.css";
import {
  MAX_TASK_DESCRIPTION,
  MAX_TASK_TITLE,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from "@/lib/portal/progress-limits";

import {
  assignTaskAction,
  createTaskAction,
  deleteTaskAction,
  setAssistantLeadAction,
  setTaskStatusAction,
} from "../tasks";

export interface TeamOption {
  memberId: string;
  name: string;
}

/**
 * Handing work out. Only a lead, an assistant lead or an administrator sees
 * it, and a task can go to one person or to several — research work is rarely
 * one person's.
 */
export function NewTask({ slug, team }: { slug: string; team: TeamOption[] }) {
  return (
    <ActionForm
      action={createTaskAction}
      className={styles.form}
      resetOnSuccess
    >
      <input type="hidden" name="slug" value={slug} />

      <div className={styles.field}>
        <label htmlFor="task-title">What needs doing</label>
        <input
          id="task-title"
          name="title"
          maxLength={MAX_TASK_TITLE}
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="task-description">Detail</label>
        <textarea
          id="task-description"
          name="description"
          rows={3}
          maxLength={MAX_TASK_DESCRIPTION}
        />
      </div>

      <fieldset className={styles.field}>
        <legend>Who</legend>
        {team.map((person) => (
          <label className={styles.whoOption} key={person.memberId}>
            <input type="checkbox" name="assigneeId" value={person.memberId} />
            {person.name}
          </label>
        ))}
        <p className={styles.hint}>
          One person or several. Leave them all clear to assign it later.
        </p>
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="task-priority">Priority</label>
        <select id="task-priority" name="priority" defaultValue="MEDIUM">
          {TASK_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {TASK_PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="task-due">Due</label>
        <input id="task-due" name="dueAt" type="date" />
        <p className={styles.hint}>Optional. End of that day, Dhaka time.</p>
      </div>

      <SubmitButton pending="Adding…">Add task</SubmitButton>
    </ActionForm>
  );
}

/**
 * Moving one task along. Whoever the task belongs to can do this, and so can
 * a lead: a board only tells the truth if the person doing the work can say
 * where it is.
 */
export function TaskControls({
  slug,
  taskId,
  status,
  canAssign,
  team,
  assigneeIds,
}: {
  slug: string;
  taskId: string;
  status: string;
  canAssign: boolean;
  team: TeamOption[];
  assigneeIds: string[];
}) {
  return (
    <div className={styles.updateControls}>
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

      {canAssign ? (
        <>
          <ActionForm action={assignTaskAction} className={styles.inlineForm}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="taskId" value={taskId} />
            <fieldset className={styles.who}>
              <legend className={styles.inlineLabel}>Who</legend>
              {team.map((person) => (
                <label className={styles.whoOption} key={person.memberId}>
                  <input
                    type="checkbox"
                    name="assigneeId"
                    value={person.memberId}
                    defaultChecked={assigneeIds.includes(person.memberId)}
                  />
                  {person.name}
                </label>
              ))}
            </fieldset>
            <SubmitButton tone="quiet" pending="Saving…">
              Assign
            </SubmitButton>
          </ActionForm>
          <ActionForm action={deleteTaskAction} className={styles.inlineForm}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="taskId" value={taskId} />
            <SubmitButton tone="quiet" pending="Deleting…">
              Delete
            </SubmitButton>
          </ActionForm>
        </>
      ) : null}
    </div>
  );
}

/**
 * Appointing an assistant research lead. They do everything the lead does on
 * this project, so it is a lead's or an administrator's decision, and never
 * one's own.
 */
export function AssistantLeadControl({
  slug,
  memberId,
  name,
  isAssistantLead,
}: {
  slug: string;
  memberId: string;
  name: string;
  isAssistantLead: boolean;
}) {
  return (
    <ActionForm action={setAssistantLeadAction} className={styles.inlineForm}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="memberId" value={memberId} />
      <input
        type="hidden"
        name="appoint"
        value={isAssistantLead ? "no" : "yes"}
      />
      <SubmitButton tone="quiet" pending="Saving…">
        {isAssistantLead
          ? `Stand ${name} down`
          : `Make ${name} an assistant lead`}
      </SubmitButton>
    </ActionForm>
  );
}
