import Link from "next/link";

import entryStyles from "@/components/entries/Entries.module.css";
import { ProjectRelationshipThreads } from "@/components/entries/ProjectRelationshipThreads";
import { StatusLabel } from "@/components/entries/StatusLabel";
import { SharedEntityTitle } from "@/components/motion/SharedEntityTitle";
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
    <article
      className={`${styles.entry} ${entryStyles.projectEntry}`}
      data-has-relationships={
        project.areas.length > 0 || project.members.length > 0
      }
    >
      <div className={styles.entryMain}>
        <SharedEntityTitle kind="project" slug={project.slug}>
          <Heading>
            <Link
              href={`/projects/${project.slug}`}
              transitionTypes={["entity-detail"]}
            >
              {project.title}
            </Link>
          </Heading>
        </SharedEntityTitle>
        <p className={styles.entrySummary}>{project.gloss}</p>
      </div>
      <ProjectRelationshipThreads
        areaCount={project.areas.length}
        researcherCount={project.members.length}
      />
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
