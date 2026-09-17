"use client";

import { type FormEvent, useCallback, useState } from "react";

import {
  ErrorSummary,
  FieldError,
  describedBy,
} from "@/components/forms/FormStatus";
import { TurnstileField } from "@/components/forms/TurnstileField";
import { eventRegistrationSchema } from "@/lib/forms-event";

import styles from "./EventRegistrationForm.module.css";

type FieldErrors = Record<string, string>;

function validationErrors(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

export function EventRegistrationForm({
  slug,
  siteKey,
}: {
  slug: string;
  siteKey?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const setTurnstile = useCallback(
    (token: string) => setTurnstileToken(token),
    [],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = eventRegistrationSchema.safeParse({
      name,
      email,
      affiliation,
      consent,
      turnstileToken,
    });

    if (!parsed.success) {
      const nextErrors = validationErrors(parsed.error);
      setErrors(nextErrors);
      const first = Object.keys(nextErrors)[0];
      if (first) {
        requestAnimationFrame(() => document.getElementById(first)?.focus());
      }
      return;
    }

    setSubmitting(true);
    setErrors({});
    setMessage("Submitting your registration…");

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(slug)}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        errors?: FieldErrors;
      } | null;

      if (!response.ok) {
        if (body?.errors) setErrors(body.errors);
        throw new Error(
          body?.message || "Registration could not be submitted.",
        );
      }

      setSubmitted(true);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Registration could not be submitted. Please try again.",
      );
      setTurnstileReset((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className={styles.success} aria-live="polite">
        <span className={styles.node} aria-hidden="true" />
        <h2>Registration received.</h2>
        <p>Your place has been recorded for this event.</p>
      </section>
    );
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <h2>Register for this event</h2>
      <p className={styles.intro}>Fields marked * are required.</p>
      <ErrorSummary errors={errors} className={styles.errorSummary} />

      <div className={styles.field}>
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name", errors.name)}
        />
        <FieldError id="name" message={errors.name} className={styles.error} />
      </div>

      <div className={styles.field}>
        <label htmlFor="email">Email *</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", errors.email)}
        />
        <FieldError
          id="email"
          message={errors.email}
          className={styles.error}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="affiliation">Affiliation</label>
        <input
          id="affiliation"
          autoComplete="organization"
          value={affiliation}
          onChange={(event) => setAffiliation(event.target.value)}
          aria-invalid={Boolean(errors.affiliation)}
          aria-describedby={describedBy("affiliation", errors.affiliation)}
        />
        <p id="affiliation-hint" className={styles.hint}>
          University, lab, organization, or independent.
        </p>
        <FieldError
          id="affiliation"
          message={errors.affiliation}
          className={styles.error}
        />
      </div>

      <label className={styles.consent} htmlFor="consent">
        <input
          id="consent"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          aria-invalid={Boolean(errors.consent)}
          aria-describedby={describedBy("consent", errors.consent)}
        />
        <span>
          I agree that SANDHI may use these details to manage this event
          registration. *
        </span>
      </label>
      <FieldError
        id="consent"
        message={errors.consent}
        className={styles.error}
      />

      <div id="turnstileToken" tabIndex={-1} className={styles.turnstile}>
        <TurnstileField
          siteKey={siteKey}
          resetKey={turnstileReset}
          onTokenChange={setTurnstile}
        />
      </div>
      <FieldError
        id="turnstileToken"
        message={errors.turnstileToken}
        className={styles.error}
      />

      <div className={styles.actions}>
        <button type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register"}
        </button>
      </div>
      <p className={styles.status} aria-live="polite">
        {message}
      </p>
    </form>
  );
}
