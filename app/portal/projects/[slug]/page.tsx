import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectStage } from "@/components/entries/ProjectStage";
import styles from "@/components/portal/Portal.module.css";
import { Prose } from "@/components/Prose";
import { requireViewer } from "@/lib/authz";
import { humanSize } from "@/lib/portal/attachment-input";
import { projectStatusLabel } from "@/lib/project-status";
import { getProjectProgress } from "@/lib/portal/progress";

import { AttachFile } from "./AttachFile";
import { PostUpdate, RemoveAttachment, UpdateControls } from "./ProgressForms";

export const metadata: Metadata = { title: "Project progress" };

const FILE_KINDS: Record<string, string> = {
  FIGURE: "Figure",
  DOCUMENT: "Document",
  DATA: "Data",
};

function when(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export default async function ProjectProgressPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireViewer(`/portal/projects/${slug}`);
  const project = await getProjectProgress(viewer, slug);
  if (!project) notFound();

  const isPublic = project.state === "PUBLISHED";
  const published = project.updates.filter((update) => update.isPublic).length;

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/portal/projects">My projects</Link>
      </nav>
      <header className={styles.intro}>
        <h1>{project.title}</h1>
        <p className={styles.lead}>{project.gloss}</p>
        <p className={styles.cardMeta}>
          {project.role}
          {project.isLead ? " · lead" : ""} ·{" "}
          {projectStatusLabel(project.status)} ·{" "}
          {isPublic ? (
            <Link href={`/projects/${project.slug}`}>public page</Link>
          ) : (
            "the project is not public yet, so nothing here is either"
          )}
        </p>
      </header>

      <section className={styles.section} aria-label="Stage">
        <ProjectStage status={project.status} />
        <p className={styles.cardMeta}>
          An administrator sets the stage in the Projects manager.{" "}
          {published > 0
            ? `${published} of ${project.updates.length} updates ${published === 1 ? "is" : "are"} public.`
            : "No update is public yet."}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="post-update">
        <h2 id="post-update">Post an update</h2>
        <p className={styles.cardMeta}>
          Written for the team. Publishing it to the project&rsquo;s public page
          is a separate step, so a working note is never published by accident.
        </p>
        <PostUpdate slug={project.slug} />
      </section>

      <section aria-labelledby="history">
        <h2 className={styles.historyHeading} id="history">
          History
        </h2>
        {project.updates.length === 0 ? (
          <p className={styles.cardMeta}>Nothing written yet.</p>
        ) : (
          <ol className={styles.cardList}>
            {project.updates.map((update) => (
              <li className={styles.card} key={update.id}>
                <h3>{update.title}</h3>
                <p className={styles.cardMeta}>
                  {update.author?.name ?? "A former member"} ·{" "}
                  <time dateTime={update.createdAt.toISOString()}>
                    {when(update.createdAt)}
                  </time>{" "}
                  · at {projectStatusLabel(update.stage)} ·{" "}
                  {update.isPublic ? "public" : "internal"}
                </p>
                <Prose>{update.body}</Prose>
                {update.nextUp ? (
                  <p className={styles.cardNext}>
                    <span className={styles.cardNextLabel}>Next</span>
                    {update.nextUp}
                  </p>
                ) : null}
                {update.attachments.length > 0 ? (
                  <ul className={styles.attachList}>
                    {update.attachments.map((file) => (
                      <li key={file.id}>
                        <a href={`/files/updates/${file.id}`}>{file.title}</a>
                        <span className={styles.cardMeta}>
                          {FILE_KINDS[file.kind] ?? file.kind} ·{" "}
                          {humanSize(file.byteSize)}
                        </span>
                        {update.mine || project.isLead ? (
                          <RemoveAttachment
                            slug={project.slug}
                            attachmentId={file.id}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {update.mine || project.isLead ? (
                  <AttachFile
                    key={update.attachments.length}
                    slug={project.slug}
                    updateId={update.id}
                  />
                ) : null}
                {update.mine || project.isLead ? (
                  <UpdateControls
                    slug={project.slug}
                    id={update.id}
                    isPublic={update.isPublic}
                    projectIsPublic={isPublic}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
