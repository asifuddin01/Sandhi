"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { useFormAction } from "@/components/forms/useFormAction";
import type { ActionState } from "@/lib/admin/actions";

import styles from "./Admin.module.css";

export type AdminAction = (
  previous: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const idle: ActionState = { status: "idle" };

/**
 * With `name` and `value`, several buttons can share one form (one per row or
 * operation); only the pressed button shows its pending label.
 */
export function SubmitButton({
  children,
  pending,
  tone = "primary",
  name,
  value,
}: {
  children: ReactNode;
  pending: string;
  tone?: "primary" | "quiet" | "danger";
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const pressed = status.pending && (!name || status.data?.get(name) === value);
  return (
    <button
      className={
        tone === "primary" ? "button button-primary" : styles.quietButton
      }
      data-tone={tone}
      type="submit"
      name={name}
      value={value}
      disabled={status.pending}
    >
      {pressed ? pending : children}
    </button>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  return (
    <p
      className={styles.actionMessage}
      data-tone={state.status}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message ?? ""}
    </p>
  );
}

/**
 * A server-action form that reports its outcome in a live region. A failed
 * submission keeps what was typed; `resetOnSuccess` clears the form once the
 * action succeeds (for forms that create something, like an invitation).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: AdminAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const { state, formAction, onSubmit } = useFormAction(action, idle);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") form.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <form
      ref={form}
      className={className ?? styles.actionForm}
      action={formAction}
      onSubmit={onSubmit}
    >
      {children}
      <ActionMessage state={state} />
    </form>
  );
}

/**
 * Confirms an irreversible action by asking for the member's name and the
 * administrator's own password, in a native dialog that traps focus and
 * closes on Escape. The password is cleared as soon as it is sent.
 */
export function ConfirmByNameDialog({
  action,
  name,
  hidden,
  trigger,
  title,
  description,
  confirmLabel,
}: {
  action: AdminAction;
  name: string;
  hidden: Record<string, string>;
  trigger: string;
  title: string;
  description: string;
  confirmLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const { state, formAction, onSubmit } = useFormAction(action, idle);
  const titleId = `${confirmLabel.replace(/\W+/gu, "-").toLowerCase()}-title`;

  return (
    <>
      <button
        className={styles.quietButton}
        data-tone="danger"
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => {
          setTyped("");
          setPassword("");
        }}
      >
        <form
          action={formAction}
          onSubmit={(event) => {
            onSubmit(event);
            setPassword("");
          }}
          className={styles.dialogForm}
        >
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
          {Object.entries(hidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <div className={styles.field}>
            <label htmlFor={`${titleId}-confirmation`}>
              Type <strong>{name}</strong> to confirm
            </label>
            <input
              id={`${titleId}-confirmation`}
              name="confirmation"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${titleId}-password`}>Your password</label>
            <input
              id={`${titleId}-password`}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <ActionMessage state={state} />
          <div className={styles.dialogActions}>
            <button
              className={styles.quietButton}
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            {typed === name && password ? (
              <SubmitButton tone="danger" pending="Working…">
                {confirmLabel}
              </SubmitButton>
            ) : (
              <button
                className={styles.quietButton}
                data-tone="danger"
                type="button"
                disabled
              >
                {confirmLabel}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
