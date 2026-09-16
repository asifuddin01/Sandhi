import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicationEntries } from "@/components/entries/PublicationEntries";
import { StatusLabel } from "@/components/entries/StatusLabel";
import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { Prose } from "@/components/Prose";
import { getProjectBySlug } from "@/lib/public-research";

export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) return { title: "Project not found" };

  return {
    title: project.title,
    description: project.gloss,
    alternates: { canonical: `/projects/${project.slug}` },
  };
}

function projectTimeline(startedAt: string | null, endedAt: string | null) {
  const start = startedAt ? new Date(startedAt).getUTCFullYear() : null;
  const end = endedAt ? new Date(endedAt).getUTCFullYear() : null;
  if (start && end) return `${start}–${end}`;
  if (start) return `Started ${start}`;
  if (end) return `Completed ${end}`;
  return null;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const timeline = projectTimeline(project.startedAt, project.endedAt);

  return (
    <div className={styles.page}>
      <PageIntro title={project.title} lead={project.gloss} />

      <div className={styles.connections} aria-label="Project connections">
        <div className={styles.connectionGroup}>
          {project.areas.map((area) => (
            <span key={area.slug}>{area.name}</span>
          ))}
        </div>
        <div className={styles.connectionLabels} aria-hidden="true">
          <span className={styles.connectionLine} />
          <span className={styles.connectionNode}>{project.title}</span>
        </div>
        <div className={styles.connectionLabels}>
          <span className={styles.connectionLine} aria-hidden="true" />
          <div className={styles.connectionGroup}>
            {project.members.map((member) => (
              <Link href={`/people/${member.slug}`} key={member.slug}>
                {member.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section className={styles.section} aria-labelledby="status-heading">
        <h2 className="visually-hidden" id="status-heading">
          Project status
        </h2>
        <div className={styles.resourceLinks}>
          <StatusLabel status={project.status} />
          {timeline ? <span>{timeline}</span> : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="abstract-heading">
        <div className={styles.sectionHeader}>
          <h2 id="abstract-heading">Abstract</h2>
        </div>
        <Prose className={styles.prose}>{project.abstract}</Prose>
      </section>

      <section className={styles.section} aria-labelledby="question-heading">
        <div className={styles.sectionHeader}>
          <h2 id="question-heading">Research question</h2>
        </div>
        <Prose className={styles.prose}>{project.question}</Prose>
      </section>

      {project.motivation ? (
        <section
          className={styles.section}
          aria-labelledby="motivation-heading"
        >
          <div className={styles.sectionHeader}>
            <h2 id="motivation-heading">Motivation</h2>
          </div>
          <Prose className={styles.prose}>{project.motivation}</Prose>
        </section>
      ) : null}

      {project.approach ? (
        <section className={styles.section} aria-labelledby="approach-heading">
          <div className={styles.sectionHeader}>
            <h2 id="approach-heading">Approach</h2>
          </div>
          <Prose className={styles.prose}>{project.approach}</Prose>
        </section>
      ) : null}

      {project.experiments ? (
        <section
          className={styles.section}
          aria-labelledby="experiments-heading"
        >
          <div className={styles.sectionHeader}>
            <h2 id="experiments-heading">Experiments</h2>
          </div>
          <Prose className={styles.prose}>{project.experiments}</Prose>
        </section>
      ) : null}

      {project.results ? (
        <section className={styles.section} aria-labelledby="results-heading">
          <div className={styles.sectionHeader}>
            <h2 id="results-heading">Results</h2>
          </div>
          <Prose className={styles.prose}>{project.results}</Prose>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="researchers-heading">
        <div className={styles.sectionHeader}>
          <h2 id="researchers-heading">Researchers</h2>
        </div>
        {project.members.length > 0 ? (
          <ul className={styles.resourceList}>
            {project.members.map((member) => (
              <li key={member.slug}>
                <h3>
                  <Link href={`/people/${member.slug}`}>{member.name}</Link>
                </h3>
                <p>
                  {member.role}
                  {member.isLead ? ", project lead" : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            Researcher profiles for this project are being prepared.
          </EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="areas-heading">
        <div className={styles.sectionHeader}>
          <h2 id="areas-heading">Research areas</h2>
        </div>
        {project.areas.length > 0 ? (
          <ol className={styles.relatedThreads}>
            {project.areas.map((area) => (
              <li key={area.slug}>
                <Link href={`/research/areas/${area.slug}`}>{area.name}</Link>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState>
            Research areas for this project are being prepared.
          </EmptyState>
        )}
      </section>

      {project.links.length > 0 ? (
        <section className={styles.section} aria-labelledby="links-heading">
          <div className={styles.sectionHeader}>
            <h2 id="links-heading">Project links</h2>
          </div>
          <div className={styles.resourceLinks}>
            {project.links.map((link) => (
              <a className={styles.textLink} href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {project.publications.length > 0 ? (
        <section
          className={styles.section}
          aria-labelledby="publications-heading"
        >
          <div className={styles.sectionHeader}>
            <h2 id="publications-heading">Publications</h2>
          </div>
          <PublicationEntries publications={project.publications} />
        </section>
      ) : null}

      {project.relatedProjects.length > 0 ? (
        <section className={styles.section} aria-labelledby="related-heading">
          <div className={styles.sectionHeader}>
            <h2 id="related-heading">Related projects</h2>
          </div>
          <ul className={styles.resourceList}>
            {project.relatedProjects.map((related) => (
              <li key={related.slug}>
                <h3>
                  <Link href={`/projects/${related.slug}`}>
                    {related.title}
                  </Link>
                </h3>
                <p>{related.gloss}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
