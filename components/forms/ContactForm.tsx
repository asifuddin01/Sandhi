"use client";

import { type FormEvent, useCallback, useState } from "react";

import {
  ErrorSummary,
  FieldError,
  describedBy,
} from "@/components/forms/FormStatus";
import { TurnstileField } from "@/components/forms/TurnstileField";
import {
  contactSubmissionSchema,
  contactTopics,
  flattenZodErrors,
  type ContactTopic,
  type FieldErrors,
} from "@/lib/forms";

import styles from "./ContactForm.module.css";

type ContactDraft = {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
};

const initialDraft: ContactDraft = {
  name: "",
  email: "",
  topic: "general",
  message: "",
};

export function ContactForm({ siteKey }: { siteKey?: string }) {
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const setTurnstile = useCallback(
    (token: string) => setTurnstileToken(token),
    [],
  );

  const update = <Key extends keyof ContactDraft>(
    key: Key,
    value: ContactDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = contactSubmissionSchema.safeParse({
      ...draft,
      turnstileToken,
    });

    if (!result.success) {
      const nextErrors = flattenZodErrors(result.error);
      setErrors(nextErrors);
      const first = Object.keys(nextErrors)[0];
      if (first)
        requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setMessage("Sending your message…");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        errors?: FieldErrors;
      } | null;

      if (!response.ok) {
        if (body?.errors) setErrors(body.errors);
        throw new Error(body?.message || "Your message could not be sent.");
      }

      setSubmitted(true);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Your message could not be sent. Please try again.",
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
        <h2>Message sent.</h2>
        <p>Thank you for getting in touch. We will reply by email.</p>
      </section>
    );
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <h2>Send an inquiry</h2>
      <p className={styles.intro}>Fields marked * are required.</p>
      <ErrorSummary errors={errors} className={styles.errorSummary} />

      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            value={draft.name}
            autoComplete="name"
            onChange={(event) => update("name", event.target.value)}
            aria-describedby={describedBy("name", errors.name)}
            aria-invalid={Boolean(errors.name)}
          />
          <FieldError
            id="name"
            message={errors.name}
            className={styles.error}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            value={draft.email}
            autoComplete="email"
            onChange={(event) => update("email", event.target.value)}
            aria-describedby={describedBy("email", errors.email)}
            aria-invalid={Boolean(errors.email)}
          />
          <FieldError
            id="email"
            message={errors.email}
            className={styles.error}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="topic">Topic *</label>
        <select
          id="topic"
          value={draft.topic}
          onChange={(event) =>
            update("topic", event.target.value as ContactTopic)
          }
          aria-describedby={describedBy("topic", errors.topic)}
          aria-invalid={Boolean(errors.topic)}
        >
          {contactTopics.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldError
          id="topic"
          message={errors.topic}
          className={styles.error}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="message">Message *</label>
        <textarea
          id="message"
          value={draft.message}
          rows={9}
          maxLength={5000}
          onChange={(event) => update("message", event.target.value)}
          aria-describedby={describedBy("message", errors.message, "message")}
          aria-invalid={Boolean(errors.message)}
        />
        <p id="message-hint" className={styles.hint}>
          {draft.message.length}/5,000 characters
        </p>
        <FieldError
          id="message"
          message={errors.message}
          className={styles.error}
        />
      </div>

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
          {submitting ? "Sending…" : "Send message"}
        </button>
      </div>
      <p className={styles.status} aria-live="polite">
        {message}
      </p>
    </form>
  );
}
