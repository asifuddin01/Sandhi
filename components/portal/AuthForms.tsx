"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  acceptInvitationAction,
  requestPasswordResetAction,
  resetPasswordAction,
  signInAction,
  type AuthFormState,
} from "@/app/portal/actions";

import styles from "./Portal.module.css";

const idle: AuthFormState = { status: "idle" };

function SubmitButton({ label, pending }: { label: string; pending: string }) {
  const { pending: submitting } = useFormStatus();
  return (
    <button
      className={`button button-primary ${styles.submit}`}
      type="submit"
      disabled={submitting}
    >
      {submitting ? pending : label}
    </button>
  );
}

function FormMessage({ state }: { state: AuthFormState }) {
  if (!state.message) return <p className={styles.message} role="status" />;
  return (
    <p
      className={styles.message}
      data-tone={state.status}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, idle);

  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="next" value={next} />
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton label="Sign in" pending="Signing in…" />
      <p className={styles.aside}>
        <Link href="/portal/reset-password">Forgot your password?</Link>
      </p>
    </form>
  );
}

export function RequestResetForm() {
  const [state, action] = useActionState(requestPasswordResetAction, idle);

  return (
    <form className={styles.form} action={action}>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton label="Send reset link" pending="Sending…" />
      <p className={styles.aside}>
        <Link href="/portal/sign-in">Return to sign in</Link>
      </p>
    </form>
  );
}

function NewPasswordFields({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          aria-describedby="password-hint"
          autoFocus={autoFocus}
          required
        />
        <p id="password-hint" className={styles.hint}>
          At least 12 characters.
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="confirmation">Confirm password</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
    </>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idle);

  if (state.status === "success") {
    return (
      <div className={styles.form}>
        <FormMessage state={state} />
        <Link className="button button-primary" href="/portal/sign-in">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="token" value={token} />
      <NewPasswordFields autoFocus />
      <FormMessage state={state} />
      <SubmitButton label="Change password" pending="Changing…" />
    </form>
  );
}

export function AcceptInvitationForm({
  token,
  email,
  suggestedName,
}: {
  token: string;
  email: string;
  suggestedName: string;
}) {
  const [state, action] = useActionState(acceptInvitationAction, idle);

  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="token" value={token} />
      <div className={styles.field}>
        <span className={styles.label}>Email</span>
        <p className={styles.readonly}>{email}</p>
      </div>
      <div className={styles.field}>
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={suggestedName}
          maxLength={120}
          required
        />
      </div>
      <NewPasswordFields />
      <FormMessage state={state} />
      <SubmitButton label="Create account" pending="Creating…" />
    </form>
  );
}
