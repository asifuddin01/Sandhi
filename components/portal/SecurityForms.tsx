"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  changePasswordAction,
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  manageSessionsAction,
  regenerateBackupCodesAction,
  startTwoFactorSetupAction,
  type TwoFactorState,
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

function PasswordField({ id }: { id: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>Your password</label>
      <input
        id={id}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
    </div>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <>
      <ul className={styles.codes} aria-label="Backup codes">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        Save these somewhere safe, such as a password manager. Each signs you in
        once if you lose your phone. They will not be shown again.
      </p>
    </>
  );
}

function TwoFactorSetupSteps() {
  const start = useFormAction<TwoFactorState>(startTwoFactorSetupAction, idle);
  const confirm = useFormAction(confirmTwoFactorSetupAction, idle);
  const setup = start.state.setup;

  if (!setup) {
    return (
      <form
        className={styles.form}
        action={start.formAction}
        onSubmit={start.onSubmit}
      >
        <PasswordField id="twoFactorPassword" />
        <Message state={start.state} />
        <Submit primary pending="Preparing…">
          Set up two-factor authentication
        </Submit>
      </form>
    );
  }

  return (
    <ol className={styles.steps}>
      <li>
        <p>Scan this code with an authenticator app.</p>
        <svg
          className={styles.qr}
          role="img"
          aria-label="QR code for your authenticator app"
          viewBox={`0 0 ${setup.size} ${setup.size}`}
          shapeRendering="crispEdges"
        >
          <rect width={setup.size} height={setup.size} fill="#fff" />
          <path d={setup.qrPath} fill="#000" />
        </svg>
        <p className={styles.hint}>
          Or type this key into the app:{" "}
          <code className={styles.key}>
            {setup.key.match(/.{1,4}/gu)?.join(" ")}
          </code>
        </p>
      </li>
      <li>
        <p>Save your backup codes.</p>
        <BackupCodes codes={setup.backupCodes} />
      </li>
      <li>
        <form
          className={styles.form}
          action={confirm.formAction}
          onSubmit={confirm.onSubmit}
        >
          <div className={styles.field}>
            <label htmlFor="setupCode">Code from the app</label>
            <input
              id="setupCode"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              required
            />
          </div>
          <Message state={confirm.state} />
          <Submit primary pending="Checking…">
            Turn on two-factor authentication
          </Submit>
        </form>
      </li>
    </ol>
  );
}

function TwoFactorOn({ required }: { required: boolean }) {
  const regenerate = useFormAction<TwoFactorState>(
    regenerateBackupCodesAction,
    idle,
  );
  const disable = useFormAction(disableTwoFactorAction, idle);

  return (
    <>
      <p className={styles.statusLine}>
        <span className={styles.badge}>On</span>
        {required
          ? "Your role requires two-factor authentication, so it stays on."
          : "You sign in with your password and a code from your app."}
      </p>

      <form
        className={styles.form}
        action={regenerate.formAction}
        onSubmit={regenerate.onSubmit}
      >
        <p className={styles.hint}>
          Lost your backup codes, or used most of them? New ones replace them
          all.
        </p>
        <PasswordField id="backupCodesPassword" />
        <Message state={regenerate.state} />
        {regenerate.state.backupCodes ? (
          <BackupCodes codes={regenerate.state.backupCodes} />
        ) : null}
        <Submit pending="Creating…">Create new backup codes</Submit>
      </form>

      {required ? null : (
        <form
          className={styles.form}
          action={disable.formAction}
          onSubmit={disable.onSubmit}
        >
          <PasswordField id="disablePassword" />
          <Message state={disable.state} />
          <Submit pending="Turning off…">
            Turn off two-factor authentication
          </Submit>
        </form>
      )}
    </>
  );
}

export function TwoFactorSection({
  enabled,
  required,
}: {
  enabled: boolean;
  required: boolean;
}) {
  return enabled ? (
    <TwoFactorOn required={required} />
  ) : (
    <TwoFactorSetupSteps />
  );
}
