import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectEntry } from "@/components/entries/ProjectEntry";
import { PublicationEntries } from "@/components/entries/PublicationEntries";
import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { Prose } from "@/components/Prose";
import { getThemeBySlug } from "@/lib/public-research";

export const dynamic = "force-dynamic";

interface ThemePageProps {
  params: Promise<{ theme: string }>;
}

export async function generateMetadata({
  params,
}: ThemePageProps): Promise<Metadata> {
  const { theme: slug } = await params;
  const theme = await getThemeBySlug(slug);

  if (!theme) return { title: "Research theme not found" };

  return {
    title: theme.name,
    description: theme.gloss,
    alternates: { canonical: `/research/${theme.slug}` },
  };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { theme: slug } = await params;
  const theme = await getThemeBySlug(slug);
  if (!theme) notFound();

  return (
    <div className={styles.page}>
      <PageIntro title={theme.name} lead={theme.gloss} />

      <section className={styles.section} aria-labelledby="overview-heading">
        <div className={styles.sectionHeader}>
          <h2 id="overview-heading">Overview</h2>
        </div>
        {theme.overview ? (
          <Prose className={styles.prose}>{theme.overview}</Prose>
        ) : (
          <EmptyState>A detailed overview is being prepared.</EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="areas-heading">
        <div className={styles.sectionHeader}>
          <h2 id="areas-heading">Research areas</h2>
        </div>
        {theme.areas.length > 0 ? (
          <ol className={styles.themeMap}>
            {theme.areas.map((area) => (
              <li className={styles.themeRow} key={area.slug}>
                <div className={styles.themeIdentity}>
                  <h3>
                    <Link href={`/research/areas/${area.slug}`}>
                      {area.name}
                    </Link>
                  </h3>
                </div>
                <p className={styles.areaSummary}>{area.summary}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState>
            Research areas for this theme are being prepared.
          </EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="projects-heading">
        <div className={styles.sectionHeader}>
          <h2 id="projects-heading">Projects</h2>
        </div>
        {theme.projects.length > 0 ? (
          <div className={styles.entryList}>
            {theme.projects.map((project) => (
              <ProjectEntry
                key={project.slug}
                project={project}
                headingLevel="h3"
              />
            ))}
          </div>
        ) : (
          <EmptyState>
            Our first projects in this theme will appear here.
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
        {theme.publications.length > 0 ? (
          <PublicationEntries publications={theme.publications} />
        ) : (
          <EmptyState>Publications in this theme are in progress.</EmptyState>
        )}
      </section>
    </div>
  );
}
