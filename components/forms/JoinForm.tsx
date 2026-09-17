"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ErrorSummary,
  FieldError,
  describedBy,
} from "@/components/forms/FormStatus";
import { TurnstileField } from "@/components/forms/TurnstileField";
import {
  flattenZodErrors,
  isValidPdf,
  joinAboutSchema,
  joinInterestSchema,
  joinInterestTypes,
  joinMotivationSchema,
  researchInterestOptions,
  requiresCv,
  requiresProposal,
  requiresProposalFile,
  type FieldErrors,
  type JoinInterestType,
} from "@/lib/forms";

import styles from "./JoinForm.module.css";

type Draft = {
  type: JoinInterestType | "";
  name: string;
  email: string;
  phone: string;
  institution: string;
  currentRole: string;
  interests: string[];
  customInterest: string;
  motivation: string;
  experience: string;
  proposalTitle: string;
  proposalSummary: string;
  hoursPerWeek: string;
  consent: boolean;
};

type JoinStep = 1 | 2 | 3;

export type JoinOpportunitySelection = {
  slug: string;
  title: string;
  type: JoinInterestType;
};

const storageKey = "sandhi:join-application:v2";
const joinStepHistoryKey = "__sandhiJoinStep";
const scrollEntryHistoryKey = "__sandhiScrollEntry";

const defaultDraft: Draft = {
  type: "",
  name: "",
  email: "",
  phone: "",
  institution: "",
  currentRole: "",
  interests: [],
  customInterest: "",
  motivation: "",
  experience: "",
  proposalTitle: "",
  proposalSummary: "",
  hoursPerWeek: "",
  consent: false,
};

function restoreDraft(value: unknown, fallback: Draft): Draft {
  if (!value || typeof value !== "object") return fallback;
  const source = value as Record<string, unknown>;
  const restored = { ...fallback };

  for (const key of Object.keys(defaultDraft) as (keyof Draft)[]) {
    if (key === "interests") {
      if (Array.isArray(source[key])) {
        restored[key] = source[key]
          .filter((item): item is string => typeof item === "string")
          .slice(0, 12);
      }
    } else if (key === "consent") {
      if (typeof source[key] === "boolean") restored[key] = source[key];
    } else if (key === "type") {
      if (joinInterestTypes.some(({ value: item }) => item === source[key])) {
        restored[key] = source[key] as JoinInterestType;
      }
    } else if (typeof source[key] === "string") {
      restored[key] = source[key] as never;
    }
  }

  return restored;
}

function combinedInterests(draft: Draft): string[] {
  const custom = draft.customInterest.trim();
  return custom ? [...draft.interests, custom] : draft.interests;
}

function focusFirstError(errors: FieldErrors) {
  const field = Object.keys(errors)[0];
  if (!field) return;
  requestAnimationFrame(() => document.getElementById(field)?.focus());
}

function joinStepFromHistoryState(state: unknown): JoinStep | null {
  if (!state || typeof state !== "object") return null;
  const value = Reflect.get(state, joinStepHistoryKey);
  return value === 1 || value === 2 || value === 3 ? value : null;
}

function historyStateForJoinStep(step: JoinStep, isNewEntry: boolean) {
  const state =
    window.history.state && typeof window.history.state === "object"
      ? { ...(window.history.state as Record<string, unknown>) }
      : {};

  // ScrollRestoration gives pushed entries their own position key. Keep Next's
  // router state, but do not carry the current scroll entry into a new entry.
  if (isNewEntry) delete state[scrollEntryHistoryKey];
  state[joinStepHistoryKey] = step;
  return state;
}

function pushJoinStep(step: JoinStep): void {
  window.history.pushState(
    historyStateForJoinStep(step, true),
    "",
    window.location.href,
  );
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const result = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return new Error(result?.message || fallback);
}

async function uploadPdf(file: File, kind: "cv" | "proposal") {
  const intentResponse = await fetch("/api/join/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      name: file.name,
      size: file.size,
      mime: "application/pdf",
    }),
  });

  if (!intentResponse.ok) {
    throw await responseError(
      intentResponse,
      "The upload could not be prepared.",
    );
  }

  const intent = (await intentResponse.json()) as {
    uploadUrl: string;
    key: string;
    uploadToken: string;
  };
  const uploadResponse = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("The PDF upload failed. Please try again.");
  }

  return { key: intent.key, uploadToken: intent.uploadToken };
}

const proposalCopy: Record<
  Exclude<JoinInterestType, "RESEARCHER" | "INTERNSHIP">,
  {
    heading: string;
    title: string;
    summary: string;
    file: string;
    hint: string;
  }
> = {
  COLLABORATION: {
    heading: "Research collaboration",
    title: "Collaboration title *",
    summary: "Shared question and proposed approach *",
    file: "Collaboration brief (optional PDF, max 10 MB)",
    hint: "A short brief can add detail beyond the summary above.",
  },
  PROJECT_PROPOSAL: {
    heading: "Project proposal",
    title: "Proposal title *",
    summary: "Research question, approach, and intended contribution *",
    file: "Full proposal (PDF, max 10 MB) *",
    hint: "Attach the full project proposal.",
  },
  ACADEMIC_COLLABORATION: {
    heading: "Academic collaboration",
    title: "Collaboration title *",
    summary: "Research fit and shared plan *",
    file: "Academic collaboration brief (optional PDF, max 10 MB)",
    hint: "You may attach a concept note or existing academic proposal.",
  },
  INDUSTRY_COLLABORATION: {
    heading: "Industry collaboration",
    title: "Collaboration title *",
    summary: "Problem, available context, and intended outcome *",
    file: "Partnership brief (optional PDF, max 10 MB)",
    hint: "You may attach a non-confidential brief with additional context.",
  },
};

function supportsCv(type: JoinInterestType): boolean {
  return type === "PROJECT_PROPOSAL" || requiresCv(type);
}

export function JoinForm({
  siteKey,
  opportunity,
  requestedOpportunity,
}: {
  siteKey?: string;
  opportunity?: JoinOpportunitySelection;
  requestedOpportunity?: string;
}) {
  const initialDraft = useMemo<Draft>(
    () => ({
      ...defaultDraft,
      type: opportunity?.type ?? "",
    }),
    [opportunity],
  );
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState<JoinStep>(1);
  const [hydrated, setHydrated] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const setTurnstile = useCallback(
    (token: string) => setTurnstileToken(token),
    [],
  );

  useEffect(() => {
    let restored = initialDraft;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) restored = restoreDraft(JSON.parse(stored), initialDraft);
    } catch {
      sessionStorage.removeItem(storageKey);
    }

    queueMicrotask(() => {
      setDraft(restored);
      setHydrated(true);
    });
  }, [initialDraft]);

  useEffect(() => {
    if (!hydrated || submitted) return;
    sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, hydrated, submitted]);

  useEffect(() => {
    const restoredStep = joinStepFromHistoryState(window.history.state);
    if (restoredStep) {
      queueMicrotask(() => setStep(restoredStep));
    } else {
      window.history.replaceState(
        historyStateForJoinStep(1, false),
        "",
        window.location.href,
      );
    }

    const restoreStep = (event: PopStateEvent) => {
      const historyStep = joinStepFromHistoryState(event.state);
      if (!historyStep) return;
      setErrors({});
      setFormMessage("");
      setStep(historyStep);
    };

    window.addEventListener("popstate", restoreStep);
    return () => window.removeEventListener("popstate", restoreStep);
  }, []);

  const update = <Key extends keyof Draft>(key: Key, value: Draft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const changeFile = (
    event: ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void,
    field: "cvFile" | "proposalFile",
  ) => {
    const file = event.target.files?.[0] ?? null;
    setter(file);
    const message = file
      ? isValidPdf(file, field === "proposalFile" ? "proposal" : "cv")
      : undefined;
    setErrors((current) => {
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
    // The picker is replaced by the chosen file; keep keyboard focus there.
    if (file)
      requestAnimationFrame(() => document.getElementById(field)?.focus());
  };

  const removeFile = (
    setter: (file: File | null) => void,
    field: "cvFile" | "proposalFile",
  ) => {
    setter(null);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    requestAnimationFrame(() => document.getElementById(field)?.focus());
  };

  const goForward = () => {
    setFormMessage("");
    if (step === 1) {
      const result = joinInterestSchema.safeParse({ type: draft.type });
      if (!result.success) {
        const nextErrors = flattenZodErrors(result.error);
        setErrors(nextErrors);
        focusFirstError(nextErrors);
        return;
      }
      setErrors({});
      pushJoinStep(2);
      setStep(2);
      return;
    }

    const result = joinAboutSchema.safeParse({
      ...draft,
      interests: combinedInterests(draft),
    });
    const nextErrors = result.success ? {} : flattenZodErrors(result.error);
    const cvError =
      draft.type && supportsCv(draft.type) && (requiresCv(draft.type) || cvFile)
        ? isValidPdf(cvFile, "cv")
        : null;
    if (cvError) nextErrors.cvFile = cvError;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setErrors({});
    pushJoinStep(3);
    setStep(3);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A reload restores the step and draft, but never the selected files.
    if (!draft.type) {
      setFormMessage(
        "Return to the first step and choose what you would like to do.",
      );
      return;
    }
    if (requiresCv(draft.type) && !cvFile) {
      setFormMessage(
        "Files are not kept when the page reloads. Go back to About you and attach your CV again.",
      );
      return;
    }

    const result = joinMotivationSchema.safeParse({
      type: draft.type,
      motivation: draft.motivation,
      experience: draft.experience,
      proposalTitle: draft.proposalTitle,
      proposalSummary: draft.proposalSummary,
      hoursPerWeek: draft.hoursPerWeek,
      consent: draft.consent,
    });
    const nextErrors = result.success ? {} : flattenZodErrors(result.error);
    const proposalError = proposalFile
      ? isValidPdf(proposalFile, "proposal")
      : requiresProposalFile(draft.type)
        ? "Upload the required project proposal as a PDF."
        : null;
    if (proposalError) nextErrors.proposalFile = proposalError;
    if (!turnstileToken)
      nextErrors.turnstileToken = "Complete the anti-spam check.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormMessage("Uploading your files securely…");

    try {
      const cv =
        supportsCv(draft.type) && cvFile
          ? await uploadPdf(cvFile, "cv")
          : undefined;
      const proposal = proposalFile
        ? await uploadPdf(proposalFile, "proposal")
        : undefined;
      setFormMessage("Sending your application…");

      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: draft.type,
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          institution: draft.institution,
          currentRole: draft.currentRole,
          interests: combinedInterests(draft),
          motivation: draft.motivation,
          experience: draft.experience,
          proposalTitle: draft.proposalTitle,
          proposalSummary: draft.proposalSummary,
          hoursPerWeek: draft.hoursPerWeek,
          consent: draft.consent,
          opportunitySlug: opportunity?.slug,
          cvKey: cv?.key,
          cvUploadToken: cv?.uploadToken,
          proposalKey: proposal?.key,
          proposalUploadToken: proposal?.uploadToken,
          turnstileToken,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        errors?: FieldErrors;
      } | null;
      if (!response.ok) {
        if (body?.errors) setErrors(body.errors);
        throw new Error(body?.message || "The application could not be sent.");
      }

      sessionStorage.removeItem(storageKey);
      setSubmitted(true);
      setFormMessage("");
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "The application could not be sent. Please try again.",
      );
      setTurnstileReset((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const proposalRequired = draft.type ? requiresProposal(draft.type) : false;
  const cvRequired = draft.type ? requiresCv(draft.type) : true;
  const cvSupported = draft.type ? supportsCv(draft.type) : true;
  const proposalFileRequired = draft.type
    ? requiresProposalFile(draft.type)
    : false;
  const selectedInterest = joinInterestTypes.find(
    ({ value }) => value === draft.type,
  );
  const selectedProposalCopy =
    draft.type && proposalRequired
      ? proposalCopy[
          draft.type as Exclude<JoinInterestType, "RESEARCHER" | "INTERNSHIP">
        ]
      : null;
  const progressStep = submitted ? 4 : step;

  return (
    <div className={styles.wrapper}>
      <ol className={styles.progress} aria-label="Application progress">
        {[
          [1, "Interest"],
          [2, "About you"],
          [3, proposalRequired ? "Motivation and proposal" : "Your motivation"],
        ].map(([number, label]) => {
          const numeric = number as number;
          const state =
            numeric < progressStep
              ? "complete"
              : numeric === step
                ? "active"
                : "upcoming";
          return (
            <li
              key={numeric}
              className={styles.progressItem}
              data-state={state}
            >
              <span className={styles.progressNode} aria-hidden="true">
                {numeric}
              </span>
              <span>{label}</span>
              {numeric === step && !submitted ? (
                <span className="visually-hidden" aria-current="step">
                  Current step
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {submitted ? (
        <section className={styles.success} aria-live="polite">
          <span className={styles.successNode} aria-hidden="true" />
          <h2>Application received.</h2>
          <p>We read every application and will reply by email.</p>
        </section>
      ) : (
        <form className={styles.form} noValidate onSubmit={submit}>
          <ErrorSummary errors={errors} className={styles.errorSummary} />

          {step > 1 && selectedInterest ? (
            <p className={styles.pathIndicator}>
              You’re completing the <strong>{selectedInterest.label}</strong>{" "}
              application.
            </p>
          ) : null}

          {step === 1 ? (
            <fieldset className={styles.fieldset} disabled={!hydrated}>
              <legend>What would you like to do?</legend>
              <div id="type" className={styles.optionList} tabIndex={-1}>
                {joinInterestTypes.map(({ value, label, description }) => (
                  <label
                    key={value}
                    className={styles.option}
                    data-selected={draft.type === value}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={value}
                      checked={draft.type === value}
                      onChange={() => update("type", value)}
                    />
                    <span className={styles.optionCopy}>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </div>
              <FieldError
                id="type"
                message={errors.type}
                className={styles.error}
              />
              {opportunity ? (
                <p className={styles.contextNote}>
                  Preselected for <strong>{opportunity.title}</strong>. You can
                  choose a different path.
                </p>
              ) : requestedOpportunity ? (
                <p className={styles.contextNote} role="status">
                  That opportunity is no longer open. You can still introduce
                  yourself.
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset className={styles.fieldset} disabled={!hydrated}>
              <legend>About you</legend>
              <p className={styles.requiredNote}>
                Fields marked * are required.
              </p>
              <div className={styles.grid}>
                <TextField
                  id="name"
                  label="Full name *"
                  value={draft.name}
                  error={errors.name}
                  onChange={(value) => update("name", value)}
                  autoComplete="name"
                />
                <TextField
                  id="email"
                  label="Email *"
                  value={draft.email}
                  error={errors.email}
                  onChange={(value) => update("email", value)}
                  type="email"
                  autoComplete="email"
                />
                <TextField
                  id="phone"
                  label="Contact number"
                  value={draft.phone}
                  error={errors.phone}
                  onChange={(value) => update("phone", value)}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+880 …"
                />
                <TextField
                  id="institution"
                  label="Institution or organization *"
                  value={draft.institution}
                  error={errors.institution}
                  onChange={(value) => update("institution", value)}
                  autoComplete="organization"
                />
                <TextField
                  id="currentRole"
                  label="Current role *"
                  value={draft.currentRole}
                  error={errors.currentRole}
                  onChange={(value) => update("currentRole", value)}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Research interests *</span>
                <p id="interests-hint" className={styles.hint}>
                  Choose any relevant areas, then add an interest not listed if
                  needed.
                </p>
                <div id="interests" className={styles.checkGrid} tabIndex={-1}>
                  {researchInterestOptions.map(({ value, label }) => (
                    <label key={value} className={styles.checkOption}>
                      <input
                        type="checkbox"
                        checked={draft.interests.includes(value)}
                        onChange={(event) =>
                          update(
                            "interests",
                            event.target.checked
                              ? [...draft.interests, value]
                              : draft.interests.filter(
                                  (item) => item !== value,
                                ),
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <label className={styles.subField}>
                  <span>Another research interest</span>
                  <input
                    value={draft.customInterest}
                    onChange={(event) =>
                      update("customInterest", event.target.value)
                    }
                    maxLength={160}
                    aria-describedby={describedBy(
                      "interests",
                      errors.interests,
                      "interests",
                    )}
                    aria-invalid={Boolean(errors.interests)}
                  />
                </label>
                <FieldError
                  id="interests"
                  message={errors.interests}
                  className={styles.error}
                />
              </div>

              {cvSupported ? (
                <>
                  <FileField
                    id="cvFile"
                    label={
                      cvRequired
                        ? "CV (PDF, max 5 MB) *"
                        : "CV (optional PDF, max 5 MB)"
                    }
                    hint="The file is not saved in this browser session."
                    file={cvFile}
                    required={cvRequired}
                    error={errors.cvFile}
                    onChange={(event) => changeFile(event, setCvFile, "cvFile")}
                    onRemove={() => removeFile(setCvFile, "cvFile")}
                  />
                  {draft.type === "PROJECT_PROPOSAL" ? (
                    <p className={styles.contextNote}>
                      In the next step, describe the project and attach the
                      required proposal PDF.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className={styles.contextNote}>
                  In the next step, describe the collaboration and optionally
                  attach a PDF brief.
                </p>
              )}

              {opportunity ? (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="opportunity">
                    Opportunity
                  </label>
                  <input id="opportunity" value={opportunity.title} readOnly />
                </div>
              ) : null}
            </fieldset>
          ) : null}

          {step === 3 ? (
            <fieldset className={styles.fieldset} disabled={!hydrated}>
              <legend>
                {proposalRequired
                  ? "Motivation and proposal"
                  : "Your motivation"}
              </legend>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="motivation">
                  Why SANDHI? *
                </label>
                <textarea
                  id="motivation"
                  value={draft.motivation}
                  minLength={150}
                  maxLength={1500}
                  rows={9}
                  onChange={(event) => update("motivation", event.target.value)}
                  aria-describedby={describedBy(
                    "motivation",
                    errors.motivation,
                    "motivation",
                  )}
                  aria-invalid={Boolean(errors.motivation)}
                />
                <div id="motivation-hint" className={styles.counter}>
                  <span>150–1,500 characters</span>
                  <span>{draft.motivation.length}/1,500</span>
                </div>
                <FieldError
                  id="motivation"
                  message={errors.motivation}
                  className={styles.error}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="experience">
                  Relevant experience
                </label>
                <textarea
                  id="experience"
                  value={draft.experience}
                  maxLength={3000}
                  rows={6}
                  onChange={(event) => update("experience", event.target.value)}
                />
              </div>

              {selectedProposalCopy ? (
                <div className={styles.proposal}>
                  <h3>{selectedProposalCopy.heading}</h3>
                  <TextField
                    id="proposalTitle"
                    label={selectedProposalCopy.title}
                    value={draft.proposalTitle}
                    error={errors.proposalTitle}
                    onChange={(value) => update("proposalTitle", value)}
                  />
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="proposalSummary">
                      {selectedProposalCopy.summary}
                    </label>
                    <textarea
                      id="proposalSummary"
                      value={draft.proposalSummary}
                      maxLength={3000}
                      rows={8}
                      onChange={(event) =>
                        update("proposalSummary", event.target.value)
                      }
                      aria-describedby={describedBy(
                        "proposalSummary",
                        errors.proposalSummary,
                      )}
                      aria-invalid={Boolean(errors.proposalSummary)}
                    />
                    <FieldError
                      id="proposalSummary"
                      message={errors.proposalSummary}
                      className={styles.error}
                    />
                  </div>
                  <FileField
                    id="proposalFile"
                    label={selectedProposalCopy.file}
                    hint={`${selectedProposalCopy.hint} The file is uploaded privately.`}
                    file={proposalFile}
                    required={proposalFileRequired}
                    error={errors.proposalFile}
                    onChange={(event) =>
                      changeFile(event, setProposalFile, "proposalFile")
                    }
                    onRemove={() => removeFile(setProposalFile, "proposalFile")}
                  />
                </div>
              ) : null}

              <TextField
                id="hoursPerWeek"
                label="Availability (hours per week)"
                value={draft.hoursPerWeek}
                error={errors.hoursPerWeek}
                onChange={(value) => update("hoursPerWeek", value)}
                type="number"
                inputMode="numeric"
                min="1"
                max="168"
              />

              <label className={styles.consent}>
                <input
                  type="checkbox"
                  id="consent"
                  checked={draft.consent}
                  onChange={(event) => update("consent", event.target.checked)}
                  aria-describedby={describedBy("consent", errors.consent)}
                  aria-invalid={Boolean(errors.consent)}
                />
                <span>
                  I agree that SANDHI may store and review this application. *
                </span>
              </label>
              <FieldError
                id="consent"
                message={errors.consent}
                className={styles.error}
              />

              <div
                id="turnstileToken"
                tabIndex={-1}
                className={styles.turnstile}
              >
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
            </fieldset>
          ) : null}

          <div className={styles.actions}>
            {step > 1 ? (
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={submitting}
                onClick={() => {
                  setErrors({});
                  setFormMessage("");
                  window.history.back();
                }}
              >
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!hydrated}
                onClick={goForward}
              >
                Continue
              </button>
            ) : (
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Submit application"}
              </button>
            )}
          </div>
          <p className={styles.formMessage} aria-live="polite">
            {formMessage}
          </p>
        </form>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A PDF picker that becomes a removable file row once a file is chosen. The
 * row reflects component state, so it stays accurate after moving between
 * steps, when the browser would otherwise show an empty picker.
 */
function FileField({
  id,
  label,
  hint,
  file,
  required,
  error,
  onChange,
  onRemove,
}: {
  id: "cvFile" | "proposalFile";
  label: string;
  hint: string;
  file: File | null;
  required: boolean;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.field}>
      {file ? (
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
      ) : (
        <label id={`${id}-label`} className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      {file ? (
        <div
          id={id}
          className={styles.selectedFile}
          role="group"
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy(id, error, id)}
          data-invalid={Boolean(error)}
          tabIndex={-1}
        >
          <span className={styles.selectedFileName} title={file.name}>
            {file.name}
          </span>
          <span className={styles.selectedFileSize}>
            {formatFileSize(file.size)}
          </span>
          <button
            className={styles.removeFile}
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={onRemove}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      ) : (
        <input
          id={id}
          className={styles.fileInput}
          type="file"
          accept="application/pdf,.pdf"
          required={required}
          onChange={onChange}
          aria-describedby={describedBy(id, error, id)}
          aria-invalid={Boolean(error)}
        />
      )}
      <p id={`${id}-hint`} className={styles.hint}>
        {hint}
      </p>
      <FieldError id={id} message={error} className={styles.error} />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  ...inputProps
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "type"
>) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy(id, error)}
        aria-invalid={Boolean(error)}
        {...inputProps}
      />
      <FieldError id={id} message={error} className={styles.error} />
    </div>
  );
}
