"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { previewMarkdownAction } from "@/app/admin/preview-actions";
import { slugify } from "@/lib/content-state";

import styles from "./Admin.module.css";

/**
 * Title and address together: the address follows the title until someone
 * edits it, and never changes on its own for a record that already exists.
 */
export function TitleSlugFields({
  titleLabel = "Title",
  defaultTitle = "",
  defaultSlug = "",
  pathPrefix,
}: {
  titleLabel?: string;
  defaultTitle?: string;
  defaultSlug?: string;
  pathPrefix: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  // A record that arrives with a title but no address (an imported
  // publication) gets one straight away, rather than only once someone types.
  const [slug, setSlug] = useState(defaultSlug || slugify(defaultTitle));
  const [followsTitle, setFollowsTitle] = useState(!defaultSlug);

  return (
    <div className={styles.fieldRow}>
      <div className={styles.field}>
        <label htmlFor="title">{titleLabel}</label>
        <input
          id="title"
          name="title"
          value={title}
          maxLength={200}
          required
          onChange={(event) => {
            setTitle(event.target.value);
            if (followsTitle) setSlug(slugify(event.target.value));
          }}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="slug">Address</label>
        <input
          id="slug"
          name="slug"
          value={slug}
          maxLength={80}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby="slug-hint"
          required
          onChange={(event) => {
            setFollowsTitle(false);
            setSlug(event.target.value);
          }}
        />
        <p id="slug-hint" className={styles.hint}>
          {pathPrefix}
          {slug || "…"}
        </p>
      </div>
    </div>
  );
}

/**
 * A Markdown field with a live preview rendered by the server, a moment
 * after typing stops.
 */
export function MarkdownField({
  id,
  name,
  label,
  defaultValue = "",
  hint,
  rows = 18,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  rows?: number;
}) {
  const [text, setText] = useState(defaultValue);
  const [preview, setPreview] = useState<ReactNode>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const rendered = await previewMarkdownAction(text);
        // Ignore answers that arrive after newer typing.
        if (request === latest.current) setPreview(rendered);
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div className={styles.markdownField}>
      <div className={styles.field}>
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          name={name}
          rows={rows}
          value={text}
          spellCheck
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => setText(event.target.value)}
        />
        {hint ? (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
      <section
        className={styles.markdownPreview}
        aria-label={`${label} preview`}
        aria-busy={pending}
      >
        <p className={styles.previewLabel}>Preview</p>
        {preview ?? <p className={styles.hint}>Nothing to preview yet.</p>}
      </section>
    </div>
  );
}

/** Selects or clears every row checkbox named `ids` in the same form. */
export function SelectAllRows({ label }: { label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onChange={(event) => {
        const form = event.currentTarget.form;
        form
          ?.querySelectorAll<HTMLInputElement>('input[name="ids"]')
          .forEach((box) => {
            box.checked = event.currentTarget.checked;
          });
      }}
    />
  );
}
