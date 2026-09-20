"use client";

import { type FormEvent, useCallback, useState } from "react";

import {
  describedBy,
  ErrorSummary,
  FieldError,
} from "@/components/forms/FormStatus";
import { TurnstileField } from "@/components/forms/TurnstileField";
import {
  flattenZodErrors,
  proposalSubmissionSchema,
  type FieldErrors,
} from "@/lib/forms";
import {
  MAX_PROPOSAL_SUMMARY,
  MAX_PROPOSAL_TEXT,
  MAX_PROPOSAL_TITLE,
} from "@/lib/proposals";

import styles from "./ContactForm.module.css";

export interface AreaChoice {
  slug: string;
  name: string;
}

type Draft = {
  title: string;
  summary: string;
  question: string;
  approach: string;
  outcome: string;
  areaSlug: string;
  name: string;
  email: string;
  affiliation: string;
};

const empty: Draft = {
  title: "",
  summary: "",
  question: "",
  approach: "",
  outcome: "",
  areaSlug: "",
  name: "",
  email: "",
  affiliation: "",
};

/**
 * Sending in a research idea. Anyone may: a member, a student, a colleague at
 * another lab. A signed-in member is credited from their session, so they are
 * not asked to type their own name back at us.
 */
export function ProposalForm({
  siteKey,
  areas,
  signedInAs,
}: {
  siteKey?: string;
  areas: AreaChoice[];
  signedInAs?: { name: string; email: string } | null;
}) {
  const [draft, setDraft] = useState<Draft>({
    ...empty,
    name: signedInAs?.name ?? "",
    email: signedInAs?.email ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const setTurnstile = useCallback(
    (token: string) => setTurnstileToken(token),
    [],
  );

  const update = <Key extends keyof Draft>(key: Key, value: Draft[Key]) => {
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
    const result = proposalSubmissionSchema.safeParse({
      ...draft,
      approach: draft.approach || undefined,
      outcome: draft.outcome || undefined,
      areaSlug: draft.areaSlug || undefined,
      affiliation: draft.affiliation || undefined,
      turnstileToken,
    });

    if (!result.success) {
      const next = flattenZodErrors(result.error);
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first)
        requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setMessage("Sending your proposal…");

    try {
      const response = await fetch("/api/proposals", {
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
        throw new Error(body?.message || "Your proposal could not be sent.");
      }

      setSent(true);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Your proposal could not be sent. Please try again.",
      );
      setTurnstileReset((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <section className={styles.success} aria-live="polite">
        <span className={styles.node} aria-hidden="true" />
        <h2>Proposal received.</h2>
        <p>
          A reviewer will read it. If it is taken up you will hear from us, and
          it will be posted to the lab so people can say they would work on it.
        </p>
      </section>
    );
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <h2>Send a research proposal</h2>
      <p className={styles.intro}>Fields marked * are required.</p>
      <ErrorSummary errors={errors} className={styles.errorSummary} />

      <div className={styles.field}>
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          value={draft.title}
          maxLength={MAX_PROPOSAL_TITLE}
          onChange={(event) => update("title", event.target.value)}
          aria-describedby={describedBy("title", errors.title)}
          aria-invalid={Boolean(errors.title)}
        />
        <FieldError
          id="title"
          message={errors.title}
          className={styles.error}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="summary">In a paragraph *</label>
        <textarea
          id="summary"
          rows={3}
          value={draft.summary}
          maxLength={MAX_PROPOSAL_SUMMARY}
          onChange={(event) => update("summary", event.target.value)}
          aria-describedby={describedBy("summary", errors.summary)}
          aria-invalid={Boolean(errors.summary)}
        />
        <FieldError
          id="summary"
          message={errors.summary}
          className={styles.error}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="question">What it would ask *</label>
        <textarea
          id="question"
          rows={4}
          value={draft.question}
          maxLength={MAX_PROPOSAL_TEXT}
          onChange={(event) => update("question", event.target.value)}
          aria-describedby={describedBy("question", errors.question)}
          aria-invalid={Boolean(errors.question)}
        />
        <FieldError
          id="question"
          message={errors.question}
          className={styles.error}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="approach">How you would go about it</label>
        <textarea
          id="approach"
          rows={4}
          value={draft.approach}
          maxLength={MAX_PROPOSAL_TEXT}
          onChange={(event) => update("approach", event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="outcome">What would come of it</label>
        <textarea
          id="outcome"
          rows={3}
          value={draft.outcome}
          maxLength={MAX_PROPOSAL_TEXT}
          onChange={(event) => update("outcome", event.target.value)}
        />
      </div>

      {areas.length > 0 ? (
        <div className={styles.field}>
          <label htmlFor="areaSlug">Closest research area</label>
          <select
            id="areaSlug"
            value={draft.areaSlug}
            onChange={(event) => update("areaSlug", event.target.value)}
          >
            <option value="">Not sure</option>
            {areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {signedInAs ? (
        <p className={styles.intro}>
          Sent as {signedInAs.name}. It will be linked to your profile.
        </p>
      ) : (
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="name">Your name *</label>
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
            <label htmlFor="email">Your email *</label>
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
      )}

      <div className={styles.field}>
        <label htmlFor="affiliation">Where you are</label>
        <input
          id="affiliation"
          value={draft.affiliation}
          autoComplete="organization"
          onChange={(event) => update("affiliation", event.target.value)}
        />
      </div>

      <TurnstileField
        siteKey={siteKey}
        resetKey={turnstileReset}
        onTokenChange={setTurnstile}
      />
      <FieldError
        id="turnstileToken"
        message={errors.turnstileToken}
        className={styles.error}
      />

      <div className={styles.actions}>
        <button
          className="button button-primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Sending…" : "Send proposal"}
        </button>
        <p aria-live="polite" className={styles.status}>
          {message}
        </p>
      </div>
    </form>
  );
}
