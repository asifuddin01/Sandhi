"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  changePasswordAction,
  manageSessionsAction,
} from "@/app/portal/security/actions";
import type { AuthFormState } from "@/app/portal/actions";
import { useFormAction } from "@/components/forms/useFormAction";

import styles from "./Portal.module.css";

const idle: AuthFormState = { status: "idle" };

function Message({ state }: { state: AuthFormState }) {
  return (
    <p
      className={styles.message}
      data-tone={state.status}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message ?? ""}
    </p>
  );
}

/** Only the pressed button shows its pending label. */
function Submit({
  children,
  pending,
  name,
  value,
  primary = false,
}: {
  children: ReactNode;
  pending: string;
  name?: string;
  value?: string;
  primary?: boolean;
}) {
  const status = useFormStatus();
  const pressed = status.pending && (!name || status.data?.get(name) === value);
  return (
    <button
      className={
        primary ? `button button-primary ${styles.submit}` : styles.textButton
      }
      type="submit"
      name={name}
      value={value}
      disabled={status.pending}
    >
      {pressed ? pending : children}
    </button>
  );
}

export function ChangePasswordForm() {
  const form = useRef<HTMLFormElement>(null);
  const { state, formAction, onSubmit } = useFormAction(
    changePasswordAction,
    idle,
  );

  // Passwords stay only until they are accepted.
  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      className={styles.form}
      action={formAction}
      onSubmit={onSubmit}
    >
      <div className={styles.field}>
        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          aria-describedby="newPassword-hint"
          required
        />
        <p id="newPassword-hint" className={styles.hint}>
          At least 12 characters. Passwords known from data breaches are
          refused.
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="confirmation">Confirm new password</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <Message state={state} />
      <Submit primary pending="Changing…">
        Change password
      </Submit>
    </form>
  );
}

export type SessionRow = {
  id: string;
  device: string;
  network: string;
  signedIn: string;
  lastActive: string;
  current: boolean;
};

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const { state, formAction, onSubmit } = useFormAction(
    manageSessionsAction,
    idle,
  );
  const others = sessions.filter((session) => !session.current).length;

  return (
    <form action={formAction} onSubmit={onSubmit}>
      <ul className={styles.sessions}>
        {sessions.map((session) => (
          <li key={session.id} className={styles.session}>
            <div>
              <p className={styles.sessionDevice}>
                {session.device}
                {session.current ? (
                  <span className={styles.badge}>This device</span>
                ) : null}
              </p>
              <p className={styles.hint}>
                Network {session.network} · signed in {session.signedIn} · last
                active {session.lastActive}
              </p>
            </div>
            {session.current ? null : (
              <Submit
                name="operation"
                value={`revoke:${session.id}`}
                pending="Signing out…"
              >
                Sign out
                <span className="visually-hidden">
                  {" "}
                  {session.device}, signed in {session.signedIn}
                </span>
              </Submit>
            )}
          </li>
        ))}
      </ul>
      <Message state={state} />
      {others > 0 ? (
        <Submit name="operation" value="others" pending="Signing out…">
          Sign out of all other sessions
        </Submit>
      ) : null}
    </form>
  );
}
