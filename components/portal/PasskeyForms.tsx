"use client";

import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useFormStatus } from "react-dom";

import {
  beginPasskeySignInAction,
  finishPasskeySignInAction,
  type AuthFormState,
} from "@/app/portal/actions";
import {
  beginPasskeyRegistrationAction,
  finishPasskeyRegistrationAction,
  removePasskeyAction,
} from "@/app/portal/security/actions";
import { useFormAction } from "@/components/forms/useFormAction";

import styles from "./Portal.module.css";

const idle: AuthFormState = { status: "idle" };

/** Whether this browser can use passkeys at all, known only after mount. */
function usePasskeySupport(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // Feature detection has to run in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window.PublicKeyCredential === "function");
  }, []);
  return supported;
}

/** Turns the browser's WebAuthn refusals into something a person can act on. */
function browserProblem(error: unknown, cancelled: string): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return cancelled;
  if (name === "SecurityError") {
    return "Passkeys work only on the site's own address, not an IP address.";
  }
  if (name === "InvalidStateError") {
    return "This device already has a passkey for your account.";
  }
  return "Your browser could not use the passkey. Try again.";
}

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

export function PasskeySignIn({ next }: { next: string }) {
  const supported = usePasskeySupport();
  const [state, setState] = useState<AuthFormState>(idle);
  const [pending, startTransition] = useTransition();

  if (!supported) return null;

  const signIn = () =>
    startTransition(async () => {
      setState(idle);
      const begin = await beginPasskeySignInAction();
      if (begin.status === "error") {
        setState({ status: "error", message: begin.message });
        return;
      }
      const { startAuthentication } = await import("@simplewebauthn/browser");
      let response;
      try {
        response = await startAuthentication({
          optionsJSON: begin.options as PublicKeyCredentialRequestOptionsJSON,
        });
      } catch (error) {
        setState({
          status: "error",
          message: browserProblem(error, "Passkey sign-in was cancelled."),
        });
        return;
      }
      // On success the action redirects, so only failures come back.
      setState(await finishPasskeySignInAction({ response, next }));
    });

  return (
    <div className={styles.passkey}>
      <p className={styles.divider}>or</p>
      <button
        className={styles.passkeyButton}
        type="button"
        onClick={signIn}
        disabled={pending}
      >
        {pending ? "Waiting for your passkey…" : "Sign in with a passkey"}
      </button>
      <Message state={state} />
    </div>
  );
}

export type PasskeyRow = {
  id: string;
  name: string;
  added: string;
  synced: boolean;
};

function RemoveButton({ passkey }: { passkey: PasskeyRow }) {
  const status = useFormStatus();
  const pressed =
    status.pending && status.data?.get("operation") === `remove:${passkey.id}`;
  return (
    <button
      className={styles.textButton}
      type="submit"
      name="operation"
      value={`remove:${passkey.id}`}
      disabled={status.pending}
    >
      {pressed ? "Removing…" : "Remove"}
      <span className="visually-hidden"> passkey {passkey.name}</span>
    </button>
  );
}

export function PasskeyManager({ passkeys }: { passkeys: PasskeyRow[] }) {
  const supported = usePasskeySupport();
  const router = useRouter();
  const remove = useFormAction(removePasskeyAction, idle);
  const [state, setState] = useState<AuthFormState>(idle);
  const [pending, startTransition] = useTransition();

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const password = String(data.get("password") ?? "");

    startTransition(async () => {
      setState(idle);
      const begin = await beginPasskeyRegistrationAction({ password, name });
      if (begin.status === "error") {
        setState({ status: "error", message: begin.message });
        return;
      }
      const { startRegistration } = await import("@simplewebauthn/browser");
      let response;
      try {
        response = await startRegistration({
          optionsJSON: begin.options as PublicKeyCredentialCreationOptionsJSON,
        });
      } catch (error) {
        setState({
          status: "error",
          message: browserProblem(error, "Adding the passkey was cancelled."),
        });
        return;
      }
      const result = await finishPasskeyRegistrationAction({ response, name });
      setState(result);
      if (result.status === "success") {
        form.reset();
        router.refresh();
      }
    });
  };

  return (
    <>
      {passkeys.length > 0 ? (
        <form action={remove.formAction} onSubmit={remove.onSubmit}>
          <ul className={styles.sessions} aria-label="Your passkeys">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className={styles.session}>
                <div>
                  <p className={styles.sessionDevice}>{passkey.name}</p>
                  <p className={styles.hint}>
                    Added {passkey.added}
                    {passkey.synced ? " · synced across your devices" : ""}
                  </p>
                </div>
                <RemoveButton passkey={passkey} />
              </li>
            ))}
          </ul>
          <Message state={remove.state} />
        </form>
      ) : (
        <p className={styles.hint}>You have no passkeys yet.</p>
      )}

      {supported ? (
        <form className={styles.form} onSubmit={add}>
          <div className={styles.field}>
            <label htmlFor="passkeyName">Name for this passkey</label>
            <input
              id="passkeyName"
              name="name"
              maxLength={60}
              placeholder="Work laptop"
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="passkeyPassword">Your password</label>
            <input
              id="passkeyPassword"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Message state={state} />
          <button
            className={`button button-primary ${styles.submit}`}
            type="submit"
            disabled={pending}
          >
            {pending ? "Waiting for your device…" : "Add a passkey"}
          </button>
        </form>
      ) : (
        <p className={styles.hint}>This browser cannot use passkeys.</p>
      )}
    </>
  );
}
