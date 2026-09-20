import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectStage } from "@/components/entries/ProjectStage";
import styles from "@/components/portal/Portal.module.css";
import { Prose } from "@/components/Prose";
import { requireViewer } from "@/lib/authz";
import { humanSize } from "@/lib/portal/attachment-input";
import { diagramsForProject, getProjectProgress } from "@/lib/portal/progress";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/portal/progress-limits";
import { projectStatusLabel, researchPhaseLabel } from "@/lib/project-status";

import { AttachFile } from "./AttachFile";
import { AssistantLeadControl, NewTask, TaskControls } from "./TeamForms";
import { PostUpdate, RemoveAttachment, UpdateControls } from "./ProgressForms";
import {
  PhasePicker,
  SectionControls,
  SectionEditor,
  SectionPresets,
} from "./SectionForms";

export const metadata: Metadata = { title: "Project workspace" };

/**
 * What to call someone on this project. The role is free text an
 * administrator typed, so a lead whose role already says so is not told
 * twice — "Research Lead · Research Lead" is nobody's idea of a team list.
 */
function standing(person: {
  role: string;
  isLead: boolean;
  isAssistantLead: boolean;
}): string {
  const said = /lead/iu.test(person.role);
  if (person.isLead)
    return said ? person.role : `${person.role} · Research Lead`;
  if (person.isAssistantLead) {
    return said ? person.role : `${person.role} · Assistant Lead`;
  }
  return person.role;
}

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

function FileList({
  files,
  slug,
  editable,
}: {
  files: Array<{
    id: string;
    kind: string;
    title: string;
    byteSize: number;
  }>;
  slug: string;
  editable: boolean;
}) {
  if (files.length === 0) return null;
  return (
    <ul className={styles.attachList}>
      {files.map((file) => (
        <li key={file.id}>
          <a href={`/files/attachments/${file.id}`}>{file.title}</a>
          <span className={styles.cardMeta}>
            {FILE_KINDS[file.kind] ?? file.kind} · {humanSize(file.byteSize)}
          </span>
          {editable ? (
            <RemoveAttachment slug={slug} attachmentId={file.id} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireViewer(`/portal/projects/${slug}`);
  const project = await getProjectProgress(viewer, slug);
  if (!project) notFound();
  const diagrams = await diagramsForProject(viewer, project.id);

  const isPublic = project.state === "PUBLISHED";
  const team = project.team.map((person) => ({
    memberId: person.memberId,
    name: person.name,
  }));
  const open = project.tasks.filter((task) => task.status !== "DONE");
  const done = project.tasks.filter((task) => task.status === "DONE");
  const published = project.updates.filter((update) => update.isPublic).length;
  const sectionsPublic = project.sections.filter(
    (section) => section.isPublic,
  ).length;

  return (
    <div className={styles.page}>
      <SectionPresets />
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/portal/projects">My projects</Link>
      </nav>
      <header className={styles.intro}>
        <h1>{project.title}</h1>
        <p className={styles.lead}>{project.gloss}</p>
        <p className={styles.cardMeta}>
          {project.role}
          {project.isLead ? " · lead" : ""} ·{" "}
          {projectStatusLabel(project.status)}
          {researchPhaseLabel(project.phase)
            ? ` · ${researchPhaseLabel(project.phase)}`
            : ""}{" "}
          ·{" "}
          {isPublic ? (
            <Link href={`/projects/${project.slug}`}>public page</Link>
          ) : (
            "the project is not public yet, so nothing here is either"
          )}
        </p>
      </header>

      <section className={styles.section} aria-label="Where the work stands">
        <ProjectStage status={project.status} phase={project.phase} />
        <PhasePicker slug={project.slug} phase={project.phase} />
        <p className={styles.cardMeta}>
          An administrator sets the five stages; the step inside{" "}
          {projectStatusLabel("ACTIVE").toLowerCase()} is yours.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="team">
        <h2 id="team">Team</h2>
        <ul className={styles.attachList}>
          {project.team.map((person) => (
            <li key={person.memberId}>
              <Link href={`/people/${person.slug}`}>{person.name}</Link>
              <span className={styles.cardMeta}>
                {standing(person)}
                {person.isMe ? " · you" : ""}
              </span>
              {project.leads && !person.isLead && !person.isMe ? (
                <AssistantLeadControl
                  slug={project.slug}
                  memberId={person.memberId}
                  name={person.name}
                  isAssistantLead={person.isAssistantLead}
                />
              ) : null}
            </li>
          ))}
        </ul>
        <p className={styles.cardMeta}>
          An administrator adds people to a project and names its research lead.
          A lead or an assistant lead appoints further assistant leads, who can
          do everything a lead can here.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="tasks">
        <h2 id="tasks">Work</h2>
        {project.tasks.length === 0 ? (
          <p className={styles.cardMeta}>Nothing assigned yet.</p>
        ) : (
          <ul className={styles.taskList}>
            {[...open, ...done].map((task) => (
              <li
                className={styles.task}
                data-state={task.status}
                key={task.id}
              >
                <p className={styles.taskTitle}>
                  {task.title}
                  {task.mine ? (
                    <span className={styles.taskMine}> · yours</span>
                  ) : null}
                </p>
                <p className={styles.cardMeta}>
                  {TASK_STATUS_LABELS[task.status] ?? task.status} ·{" "}
                  {TASK_PRIORITY_LABELS[task.priority] ?? task.priority} ·{" "}
                  {task.assignees.length > 0
                    ? task.assignees.map((person) => person.name).join(", ")
                    : "nobody yet"}
                  {task.dueAt ? ` · due ${when(task.dueAt)}` : ""}
                </p>
                {task.description ? <p>{task.description}</p> : null}
                {task.mine || project.leads ? (
                  <TaskControls
                    slug={project.slug}
                    taskId={task.id}
                    status={task.status}
                    canAssign={project.leads}
                    team={team}
                    assigneeIds={task.assignees.map(
                      (person) => person.memberId,
                    )}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {project.leads ? (
          <NewTask slug={project.slug} team={team} />
        ) : (
          <p className={styles.cardMeta}>
            The research lead assigns work. You can move your own along.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="sections">
        <h2 id="sections">What this project is</h2>
        <p className={styles.cardMeta}>
          The standing account of the work — methodology, datasets, architecture
          — kept up to date in place.{" "}
          {sectionsPublic > 0
            ? `${sectionsPublic} of ${project.sections.length} ${project.sections.length === 1 ? "is" : "are"} public.`
            : "None is public yet."}
        </p>
      </section>

      {project.sections.map((section) => (
        <section
          className={styles.workSection}
          aria-label={section.title}
          key={section.id}
        >
          <h3 className={styles.workHeading}>
            {section.title}
            <span className={styles.cardMeta}>
              {" "}
              · {section.isPublic ? "public" : "internal"}
            </span>
          </h3>
          <SectionEditor
            slug={project.slug}
            section={section}
            diagrams={diagrams}
          />
          {section.diagram ? (
            <p className={styles.cardMeta}>
              Diagram:{" "}
              <Link href={`/portal/diagrams/${section.diagram.id}`}>
                {section.diagram.title}
              </Link>
            </p>
          ) : null}
          <FileList files={section.attachments} slug={project.slug} editable />
          <AttachFile
            key={section.attachments.length}
            slug={project.slug}
            sectionId={section.id}
          />
          <SectionControls
            slug={project.slug}
            sectionId={section.id}
            isPublic={section.isPublic}
            projectIsPublic={isPublic}
          />
        </section>
      ))}

      <section className={styles.section} aria-labelledby="add-section">
        <h3 id="add-section" className={styles.workHeading}>
          Add a section
        </h3>
        <SectionEditor slug={project.slug} diagrams={diagrams} />
      </section>

      <section className={styles.section} aria-labelledby="post-update">
        <h2 id="post-update">Post an update</h2>
        <p className={styles.cardMeta}>
          A dated note for the team: what happened, what comes next. Publishing
          it to the project&rsquo;s public page is a separate step, so a working
          note is never published by accident.{" "}
          {published > 0
            ? `${published} of ${project.updates.length} updates ${published === 1 ? "is" : "are"} public.`
            : "No update is public yet."}
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
            {project.updates.map((update) => {
              const editable = update.mine || project.isLead;
              return (
                <li className={styles.card} key={update.id}>
                  <h3>{update.title}</h3>
                  <p className={styles.cardMeta}>
                    {update.author?.name ?? "A former member"} ·{" "}
                    <time dateTime={update.createdAt.toISOString()}>
                      {when(update.createdAt)}
                    </time>{" "}
                    · at {projectStatusLabel(update.stage)}
                    {researchPhaseLabel(update.phase)
                      ? `, ${researchPhaseLabel(update.phase)}`
                      : ""}{" "}
                    · {update.isPublic ? "public" : "internal"}
                  </p>
                  <Prose>{update.body}</Prose>
                  {update.nextUp ? (
                    <p className={styles.cardNext}>
                      <span className={styles.cardNextLabel}>Next</span>
                      {update.nextUp}
                    </p>
                  ) : null}
                  <FileList
                    files={update.attachments}
                    slug={project.slug}
                    editable={editable}
                  />
                  {editable ? (
                    <AttachFile
                      key={update.attachments.length}
                      slug={project.slug}
                      updateId={update.id}
                    />
                  ) : null}
                  {editable ? (
                    <UpdateControls
                      slug={project.slug}
                      id={update.id}
                      isPublic={update.isPublic}
                      projectIsPublic={isPublic}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
