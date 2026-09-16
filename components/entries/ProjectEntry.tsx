import Link from "next/link";

import { StatusLabel } from "@/components/entries/StatusLabel";
import styles from "@/components/public/ResearchPages.module.css";
import type { ProjectSummary } from "@/lib/public-research";

interface ProjectEntryProps {
  project: ProjectSummary;
  headingLevel?: "h2" | "h3";
}

export function ProjectEntry({
  project,
  headingLevel = "h2",
}: ProjectEntryProps) {
  const Heading = headingLevel;
  const year = project.startedAt
    ? new Date(project.startedAt).getUTCFullYear()
    : null;

  return (
    <article className={styles.entry}>
      <div className={styles.entryMain}>
        <Heading>
          <Link href={`/projects/${project.slug}`}>{project.title}</Link>
        </Heading>
        <p className={styles.entrySummary}>{project.gloss}</p>
      </div>
      <div className={styles.entryMeta}>
        <StatusLabel status={project.status} />
        {project.areas.length > 0 ? (
          <p className={styles.metaLine}>
            {project.areas.map((area, index) => (
              <span key={area.slug}>
                <Link href={`/research/areas/${area.slug}`}>{area.name}</Link>
                {index < project.areas.length - 1 ? "," : ""}
              </span>
            ))}
          </p>
        ) : null}
        {project.members.length > 0 ? (
          <p className={styles.metaLine}>
            {project.members.map((person, index) => (
              <span key={person.slug}>
                <Link href={`/people/${person.slug}`}>{person.name}</Link>
                {index < project.members.length - 1 ? "," : ""}
              </span>
            ))}
          </p>
        ) : null}
        {year ? <time dateTime={`${year}`}>{year}</time> : null}
      </div>
    </article>
  );
}
