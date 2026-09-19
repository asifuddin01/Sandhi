"use client";

import { useId, useRef, useState } from "react";

import { ActionMessage, SubmitButton } from "@/components/admin/AdminForms";
import { useFormAction } from "@/components/forms/useFormAction";
import styles from "@/components/portal/Portal.module.css";
import {
  ATTACHMENT_RULES,
  acceptFor,
  type AttachmentKindInput,
  humanSize,
  MAX_ATTACHMENT_TITLE,
} from "@/lib/portal/attachment-input";

import { attachToUpdateAction } from "../actions";

const idle = { status: "idle" } as const;

const KIND_COPY: Record<AttachmentKindInput, { label: string; hint: string }> =
  {
    figure: {
      label: "Figure",
      hint: "An architecture or pipeline diagram, a plot, a screenshot. Shown in the update.",
    },
    document: {
      label: "Document",
      hint: "A dataset description, a protocol, a report. Offered as a download.",
    },
    data: {
      label: "Data or table",
      hint: "A table or dataset file people should open in their own tools.",
    },
  };

type Ready = {
  fileKey: string;
  uploadToken: string;
  contentType: string;
  byteSize: number;
  name: string;
};

async function message(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return body?.message || fallback;
}

/**
 * The file goes straight from the browser to private storage, and only the
 * receipt travels through the form: the page never carries the bytes, and a
 * half-finished upload leaves no row behind.
 *
 * A receipt is spent once, so the page gives this component a key that
 * changes when a file lands. React then starts it again with nothing chosen,
 * rather than offering to attach the same object twice.
 */
export function AttachFile({
  slug,
  updateId,
}: {
  slug: string;
  updateId: string;
}) {
  const fieldId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AttachmentKindInput>("figure");
  const [ready, setReady] = useState<Ready | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { state, formAction, onSubmit } = useFormAction(
    attachToUpdateAction,
    idle,
  );

  async function upload(file: File) {
    setProblem(null);
    setReady(null);
    setBusy(true);
    try {
      const contentType = file.type;
      const intentResponse = await fetch("/api/portal/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: slug,
          kind,
          contentType,
          size: file.size,
        }),
      });
      if (!intentResponse.ok) {
        throw new Error(
          await message(intentResponse, "That file was not accepted."),
        );
      }
      const intent = (await intentResponse.json()) as {
        uploadUrl: string;
        key: string;
        uploadToken: string;
      };
      const put = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) throw new Error("The upload failed. Please try again.");

      setReady({
        fileKey: intent.key,
        uploadToken: intent.uploadToken,
        contentType,
        byteSize: file.size,
        name: file.name,
      });
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "That file was not accepted.",
      );
      if (picker.current) picker.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  const rules = ATTACHMENT_RULES[kind];

  return (
    <form className={styles.attachForm} action={formAction} onSubmit={onSubmit}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={updateId} />
      <input type="hidden" name="kind" value={kind} />

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-kind`}>What is it</label>
        <select
          id={`${fieldId}-kind`}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as AttachmentKindInput);
            setReady(null);
            setProblem(null);
            if (picker.current) picker.current.value = "";
          }}
        >
          {(Object.keys(KIND_COPY) as AttachmentKindInput[]).map((value) => (
            <option key={value} value={value}>
              {KIND_COPY[value].label}
            </option>
          ))}
        </select>
        <p className={styles.hint}>{KIND_COPY[kind].hint}</p>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-file`}>Choose a file</label>
        <input
          id={`${fieldId}-file`}
          ref={picker}
          type="file"
          accept={acceptFor(kind)}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <p className={styles.hint}>
          Up to {Math.round(rules.maximumBytes / (1024 * 1024))} MB.{" "}
          {busy ? "Uploading…" : null}
          {ready ? `${ready.name} · ${humanSize(ready.byteSize)} ready.` : null}
        </p>
        {problem ? (
          <p className={styles.problem} role="alert">
            {problem}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-title`}>What to call it</label>
        <input
          id={`${fieldId}-title`}
          name="title"
          defaultValue=""
          maxLength={MAX_ATTACHMENT_TITLE}
          required
        />
      </div>

      <input type="hidden" name="fileKey" value={ready?.fileKey ?? ""} />
      <input
        type="hidden"
        name="uploadToken"
        value={ready?.uploadToken ?? ""}
      />
      <input
        type="hidden"
        name="contentType"
        value={ready?.contentType ?? ""}
      />
      <input type="hidden" name="byteSize" value={ready?.byteSize ?? ""} />

      <SubmitButton tone="quiet" pending="Attaching…">
        Attach this file
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
