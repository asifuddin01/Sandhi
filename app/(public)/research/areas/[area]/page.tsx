import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PersonEntry } from "@/components/entries/PersonEntry";
import { ProjectEntry } from "@/components/entries/ProjectEntry";
import { PublicationEntries } from "@/components/entries/PublicationEntries";
import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { Prose } from "@/components/Prose";
import { getAreaBySlug } from "@/lib/public-research";

export const dynamic = "force-dynamic";

interface AreaPageProps {
  params: Promise<{ area: string }>;
}

export async function generateMetadata({
  params,
}: AreaPageProps): Promise<Metadata> {
  const { area: slug } = await params;
  const area = await getAreaBySlug(slug);

  if (!area) return { title: "Research area not found" };

  return {
    title: area.name,
    description: area.summary,
    alternates: { canonical: `/research/areas/${area.slug}` },
  };
}

export default async function AreaPage({ params }: AreaPageProps) {
  const { area: slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) notFound();

  return (
    <div className={styles.page}>
      <PageIntro title={area.name} lead={area.summary} />

      <section className={styles.section} aria-labelledby="overview-heading">
        <div className={styles.sectionHeader}>
          <h2 id="overview-heading">Overview</h2>
        </div>
        {area.overview ? (
          <Prose className={styles.prose}>{area.overview}</Prose>
        ) : (
          <EmptyState>A detailed overview is being prepared.</EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="questions-heading">
        <div className={styles.sectionHeader}>
          <h2 id="questions-heading">Open questions</h2>
        </div>
        {area.questions.length > 0 ? (
          <ol className={styles.questionList}>
            {area.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        ) : (
          <EmptyState>
            Open questions for this area are being developed.
          </EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="projects-heading">
        <div className={styles.sectionHeader}>
          <h2 id="projects-heading">Current projects</h2>
        </div>
        {area.projects.length > 0 ? (
          <div className={styles.entryList}>
            {area.projects.map((project) => (
              <ProjectEntry
                key={project.slug}
                project={project}
                headingLevel="h3"
              />
            ))}
          </div>
        ) : (
          <EmptyState>
            Our first projects in this area will appear here.
          </EmptyState>
        )}
      </section>

      <section
        className={styles.section}
        aria-labelledby="publications-heading"
      >
        <div className={styles.sectionHeader}>
          <h2 id="publications-heading">Publications</h2>
        </div>
        {area.publications.length > 0 ? (
          <PublicationEntries publications={area.publications} />
        ) : (
          <EmptyState>Publications in this area are in progress.</EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="researchers-heading">
        <div className={styles.sectionHeader}>
          <h2 id="researchers-heading">Researchers</h2>
        </div>
        {area.researchers.length > 0 ? (
          <div className={styles.personGrid}>
            {area.researchers.map((person) => (
              <PersonEntry key={person.slug} person={person} />
            ))}
          </div>
        ) : (
          <EmptyState>
            Researcher profiles for this area are being prepared.
          </EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="resources-heading">
        <div className={styles.sectionHeader}>
          <h2 id="resources-heading">Resources</h2>
        </div>
        {area.resources.length > 0 ? (
          <ul className={styles.resourceList}>
            {area.resources.map((resource) => (
              <li key={resource.slug}>
                <h3>{resource.name}</h3>
                <p>
                  {resource.kind.toLowerCase().replaceAll("_", " ")}.{" "}
                  {resource.description}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            Datasets and code for this area will appear here.
          </EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="related-heading">
        <div className={styles.sectionHeader}>
          <h2 id="related-heading">Related areas</h2>
          <p>
            Other areas in{" "}
            <Link
              className={styles.textLink}
              href={`/research/${area.theme.slug}`}
            >
              {area.theme.name}
            </Link>
          </p>
        </div>
        {area.relatedAreas.length > 0 ? (
          <ol className={styles.relatedThreads}>
            {area.relatedAreas.map((related) => (
              <li key={related.slug}>
                <Link href={`/research/areas/${related.slug}`}>
                  {related.name}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState>No related areas have been published yet.</EmptyState>
        )}
      </section>
    </div>
  );
}
