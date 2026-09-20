"use client";

import { useId, useRef, useState } from "react";

import { ActionMessage, SubmitButton } from "@/components/admin/AdminForms";
import { useFormAction } from "@/components/forms/useFormAction";
import styles from "@/components/portal/Portal.module.css";
import {
  MAX_INTERESTS,
  MAX_PROFILE_BIO,
  MAX_PROFILE_NAME,
  MAX_PROFILE_TITLE,
  MIN_PROFILE_BIO,
  PORTRAIT_RULES,
  portraitAccept,
} from "@/lib/portal/profile-fields";

import { saveProfileAction, type ProfileFormState } from "./actions";

const idle: ProfileFormState = { status: "idle" };

export interface ProfileFormValues {
  name: string;
  title: string;
  bio: string;
  interests: string[];
  photoUrl: string | null;
  photoAlt: string;
  orgEmail: string | null;
  showOrgEmail: boolean;
  scholarUrl: string;
  orcid: string;
  githubUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  isPublic: boolean;
  portraitsEnabled: boolean;
}

type Ready = {
  fileKey: string;
  uploadToken: string;
  contentType: string;
  previewUrl: string;
  name: string;
};

async function message(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return body?.message || fallback;
}

/**
 * The profile a person writes about themselves. The photograph goes straight
 * from the browser to storage and only its receipt travels through the form,
 * so a half-finished upload leaves nothing behind and the page never carries
 * the bytes.
 */
export function ProfileForm({ profile }: { profile: ProfileFormValues }) {
  const fieldId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { state, formAction, onSubmit } = useFormAction(
    saveProfileAction,
    idle,
  );

  async function upload(file: File) {
    setProblem(null);
    setReady(null);
    setBusy(true);
    try {
      const contentType = file.type;
      const intentResponse = await fetch("/api/portal/portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, size: file.size }),
      });
      if (!intentResponse.ok) {
        throw new Error(
          await message(intentResponse, "That image was not accepted."),
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
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      });
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "That image was not accepted.",
      );
      if (picker.current) picker.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  const shownPhoto = ready?.previewUrl ?? profile.photoUrl;

  return (
    <form className={styles.form} action={formAction} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label htmlFor={`${fieldId}-name`}>Your name</label>
        <input
          id={`${fieldId}-name`}
          name="name"
          defaultValue={profile.name}
          maxLength={MAX_PROFILE_NAME}
          autoComplete="name"
          required
        />
        <p className={styles.hint}>
          As it should appear on the people pages and on any publication.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-title`}>Your role</label>
        <input
          id={`${fieldId}-title`}
          name="title"
          defaultValue={profile.title}
          maxLength={MAX_PROFILE_TITLE}
        />
        <p className={styles.hint}>
          Optional, and in your own words — &ldquo;PhD student, medical
          imaging&rdquo;. Your standing in the lab is set separately.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-bio`}>About your work</label>
        <textarea
          id={`${fieldId}-bio`}
          name="bio"
          defaultValue={profile.bio}
          maxLength={MAX_PROFILE_BIO}
          rows={6}
          required
        />
        <p className={styles.hint}>
          A short paragraph — at least {MIN_PROFILE_BIO} characters. What you
          work on, and what you are trying to find out.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-interests`}>Research interests</label>
        <textarea
          id={`${fieldId}-interests`}
          name="interests"
          defaultValue={profile.interests.join("\n")}
          rows={4}
          required
        />
        <p className={styles.hint}>
          One per line, up to {MAX_INTERESTS}.
        </p>
      </div>

      <fieldset className={styles.portrait}>
        <legend className={styles.label}>Photograph</legend>
        {shownPhoto ? (
          // A blob URL from the picker has no known size, and Next's loader
          // cannot optimise it, so this stays a plain image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.portraitPreview}
            src={shownPhoto}
            alt={
              ready
                ? "The photograph you just chose"
                : profile.photoAlt || "Your current photograph"
            }
            width={112}
            height={140}
          />
        ) : (
          <p className={styles.hint}>No photograph yet.</p>
        )}
        {profile.portraitsEnabled ? (
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-photo`}>Choose a photograph</label>
            <input
              id={`${fieldId}-photo`}
              ref={picker}
              type="file"
              accept={portraitAccept()}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <p className={styles.hint}>
              PNG, JPEG, or WebP, up to{" "}
              {Math.round(PORTRAIT_RULES.maximumBytes / (1024 * 1024))} MB.
              Shown whole rather than cropped, so a portrait works best.
              {busy ? " Uploading…" : null}
              {ready ? ` ${ready.name} ready — save to keep it.` : null}
            </p>
            {problem ? (
              <p className={styles.problem} role="alert">
                {problem}
              </p>
            ) : null}
          </div>
        ) : (
          <p className={styles.hint}>
            Photographs need file storage, which has not been connected yet.
            Everything else on this page saves as normal.
          </p>
        )}
        <input type="hidden" name="photoKey" value={ready?.fileKey ?? ""} />
        <input
          type="hidden"
          name="photoToken"
          value={ready?.uploadToken ?? ""}
        />
        <input
          type="hidden"
          name="photoType"
          value={ready?.contentType ?? ""}
        />
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-website`}>Your website</label>
        <input
          id={`${fieldId}-website`}
          name="websiteUrl"
          type="url"
          defaultValue={profile.websiteUrl}
          placeholder="https://"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-scholar`}>Google Scholar</label>
        <input
          id={`${fieldId}-scholar`}
          name="scholarUrl"
          type="url"
          defaultValue={profile.scholarUrl}
          placeholder="https://"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-orcid`}>ORCID iD</label>
        <input
          id={`${fieldId}-orcid`}
          name="orcid"
          defaultValue={profile.orcid}
          placeholder="0000-0000-0000-0000"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-github`}>GitHub</label>
        <input
          id={`${fieldId}-github`}
          name="githubUrl"
          type="url"
          defaultValue={profile.githubUrl}
          placeholder="https://"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${fieldId}-linkedin`}>LinkedIn</label>
        <input
          id={`${fieldId}-linkedin`}
          name="linkedinUrl"
          type="url"
          defaultValue={profile.linkedinUrl}
          placeholder="https://"
        />
      </div>

      {profile.orgEmail ? (
        <div className={styles.checkRow}>
          <input
            id={`${fieldId}-show-email`}
            name="showOrgEmail"
            type="checkbox"
            defaultChecked={profile.showOrgEmail}
          />
          <label htmlFor={`${fieldId}-show-email`}>
            Show {profile.orgEmail} on my public profile
          </label>
        </div>
      ) : null}

      <SubmitButton pending="Saving…">Save my profile</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
