import type { Metadata } from "next";
import Link from "next/link";

import { ProjectEntry } from "@/components/entries/ProjectEntry";
import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { emptyStateCopy } from "@/content/strings";
import {
  getProjectsIndex,
  isProjectStatus,
  PROJECT_STATUSES,
  type ProjectFilters,
} from "@/lib/public-research";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Research programs at SANDHI, from early proposals to published work.",
  alternates: { canonical: "/projects" },
};

interface ProjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusLabels: Record<(typeof PROJECT_STATUSES)[number], string> = {
  PROPOSED: "Proposed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  SUBMITTED: "Submitted",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const query = await searchParams;
  const requestedStatus = firstValue(query.status);
  const filters: ProjectFilters = {
    status:
      requestedStatus && isProjectStatus(requestedStatus)
        ? requestedStatus
        : undefined,
    theme: firstValue(query.theme),
    area: firstValue(query.area),
    researcher: firstValue(query.researcher),
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const { projects, options } = await getProjectsIndex(filters);

  return (
    <div className={styles.page}>
      <PageIntro
        title="Projects"
        lead="Research programs at SANDHI, from early proposals to published work."
      />

      <form className={styles.filterForm} action="/projects" method="get">
        <label className={styles.filterField}>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Current statuses</option>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Theme
          <select name="theme" defaultValue={filters.theme ?? ""}>
            <option value="">All themes</option>
            {options.themes.map((theme) => (
              <option key={theme.slug} value={theme.slug}>
                {theme.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Area
          <select name="area" defaultValue={filters.area ?? ""}>
            <option value="">All areas</option>
            {options.areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Researcher
          <select name="researcher" defaultValue={filters.researcher ?? ""}>
            <option value="">All researchers</option>
            {options.researchers.map((researcher) => (
              <option key={researcher.slug} value={researcher.slug}>
                {researcher.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.filterActions}>
          <button className={styles.filterSubmit} type="submit">
            Apply filters
          </button>
          {hasFilters ? (
            <Link className={styles.textLink} href="/projects">
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="project-list-heading">
        <h2 className="visually-hidden" id="project-list-heading">
          Public projects
        </h2>
        {projects.length > 0 ? (
          <div className={styles.entryList}>
            {projects.map((project) => (
              <ProjectEntry key={project.slug} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState href="/research" linkLabel="Explore research areas">
            {hasFilters
              ? "No public projects match these filters."
              : emptyStateCopy.projects}
          </EmptyState>
        )}
      </section>
    </div>
  );
}
