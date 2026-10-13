"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
 * Set around an editor opened on a public page. The form then tells its
 * action so: `own` is the address of the record the page is about (empty for
 * any other record), which lets the action follow it if the address changes.
 * `added` is called once a new record is saved.
 */
export const OnPage = createContext<{
  own: string;
  added: (() => void) | null;
} | null>(null);

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
  label,
}: {
  children: ReactNode;
  pending: string;
  tone?: "primary" | "quiet" | "danger";
  name?: string;
  value?: string;
  /** The accessible name, when the visible text is too short alone (a table row's "Show"). */
  label?: string;
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
      aria-label={label}
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
  const onPage = useContext(OnPage);
  const router = useRouter();
  // On a public page a save can leave the page behind (see `followOnPage`).
  // Going there from inside the action still works when the save unmounts
  // this form, which an effect on the result would not survive.
  const andFollow = useCallback<AdminAction>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.go) router.push(result.go);
      return result;
    },
    [action, router],
  );
  const { state, formAction, onSubmit } = useFormAction(
    onPage ? andFollow : action,
    idle,
  );
  const added = onPage?.added;

  useEffect(() => {
    if (state.status !== "success") return;
    if (resetOnSuccess) form.current?.reset();
    added?.();
  }, [resetOnSuccess, state, added]);

  return (
    <form
      ref={form}
      className={className ?? styles.actionForm}
      action={formAction}
      onSubmit={onSubmit}
    >
      {onPage ? <input type="hidden" name="onPage" value={onPage.own} /> : null}
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
