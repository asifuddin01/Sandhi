import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  MarkdownField,
  TitleSlugFields,
} from "@/components/admin/ContentFields";
import type { getNewsForEdit, getNewsLinkOptions } from "@/lib/admin/news";
import { publishStateLabels, publishStates } from "@/lib/content-state";
import { toDhakaInput } from "@/lib/dhaka-time";
import { humanizeEnum, NEWS_CATEGORIES } from "@/lib/public-content";

import { saveNewsAction } from "./actions";

type Post = NonNullable<Awaited<ReturnType<typeof getNewsForEdit>>>;
type Options = Awaited<ReturnType<typeof getNewsLinkOptions>>;

/** The news editor, for a new post or an existing one. */
export function NewsEditor({
  post,
  options,
}: {
  post?: Post;
  options: Options;
}) {
  return (
    <ActionForm action={saveNewsAction}>
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <TitleSlugFields
        defaultTitle={post?.title}
        defaultSlug={post?.slug}
        pathPrefix="/news/"
      />
      <div className={styles.field}>
        <label htmlFor="excerpt">Summary</label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={3}
          maxLength={400}
          defaultValue={post?.excerpt}
          aria-describedby="excerpt-hint"
          required
        />
        <p id="excerpt-hint" className={styles.hint}>
          One or two sentences, shown in lists, search results, and link
          previews.
        </p>
      </div>
      <MarkdownField
        id="body"
        name="body"
        label="Article"
        defaultValue={post?.body}
        hint="Markdown, with $maths$, code blocks, and tables."
      />

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="category">Category</label>
          <select
            id="category"
            name="category"
            defaultValue={post?.category ?? "ANNOUNCEMENTS"}
          >
            {NEWS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {humanizeEnum(category)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="state">State</label>
          <select id="state" name="state" defaultValue={post?.state ?? "DRAFT"}>
            {publishStates.map((state) => (
              <option key={state} value={state}>
                {publishStateLabels[state]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="publishAt">Publish time (Dhaka)</label>
          <input
            id="publishAt"
            name="publishAt"
            type="datetime-local"
            defaultValue={toDhakaInput(post?.publishAt)}
            aria-describedby="publishAt-hint"
          />
          <p id="publishAt-hint" className={styles.hint}>
            Needed for Scheduled. Empty when publishing means now.
          </p>
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="authorId">Author</label>
          <select
            id="authorId"
            name="authorId"
            defaultValue={post?.authorId ?? ""}
          >
            <option value="">No author shown</option>
            {options.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="projectId">Related project</label>
          <select
            id="projectId"
            name="projectId"
            defaultValue={post?.projectId ?? ""}
          >
            <option value="">None</option>
            {options.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="publicationId">Related publication</label>
          <select
            id="publicationId"
            name="publicationId"
            defaultValue={post?.publicationId ?? ""}
          >
            <option value="">None</option>
            {options.publications.map((publication) => (
              <option key={publication.id} value={publication.id}>
                {publication.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SubmitButton pending="Saving…">
        {post ? "Save changes" : "Create post"}
      </SubmitButton>
    </ActionForm>
  );
}
