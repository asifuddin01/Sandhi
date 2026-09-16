import type { Metadata } from "next";
import Link from "next/link";

import { ContentEmptyState } from "@/components/entries/ContentEmptyState";
import { PublicationFilterForm } from "@/components/entries/PublicationFilterForm";
import { PublicationEntry } from "@/components/entries/PublicationEntry";
import { generateBibtex, type PublicationType } from "@/lib/bibtex";
import {
  getPublications,
  type PublicationFilters,
  type PublicPublicationSummary,
} from "@/lib/public-content";

import styles from "../ContentPages.module.css";

export const metadata: Metadata = {
  title: "Publications",
  description:
    "Peer-reviewed papers, preprints, technical reports, datasets, and benchmarks from SANDHI Research Lab.",
  alternates: { canonical: "/publications" },
  openGraph: {
    title: "Publications | SANDHI Research Lab",
    description:
      "Research publications and open scholarly outputs from SANDHI Research Lab.",
    url: "/publications",
    type: "website",
  },
};

const typeLabels: Record<PublicationType, string> = {
  CONFERENCE: "Conference paper",
  JOURNAL: "Journal article",
  WORKSHOP: "Workshop paper",
  PREPRINT: "Preprint",
  TECHNICAL_REPORT: "Technical report",
  DATASET: "Dataset",
  BENCHMARK: "Benchmark",
  THESIS: "Thesis",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function bibtexFor(publication: PublicPublicationSummary): string {
  return generateBibtex({
    title: publication.title,
    type: publication.type,
    authors: publication.authors.map((author, position) => ({
      position,
      externalName: author.name,
    })),
    year: publication.year,
    publishedAt: publication.publishedAt,
    venueName: publication.venueName,
    doi: publication.doi,
    arxivId: publication.arxivId,
    pageUrl: publication.pageUrl,
    pdfUrl: publication.pdfUrl,
    datasetUrl: publication.datasetUrl,
    bibtexOverride: publication.bibtexOverride,
  });
}

function publicationGroups(
  publications: PublicPublicationSummary[],
  sort: PublicationFilters["sort"],
) {
  const grouped = new Map<number | null, PublicPublicationSummary[]>();
  for (const publication of publications) {
    const group = grouped.get(publication.year) ?? [];
    group.push(publication);
    grouped.set(publication.year, group);
  }

  return Array.from(grouped, ([year, items]) => ({
    year,
    items:
      sort === "title"
        ? items.toSorted((left, right) => left.title.localeCompare(right.title))
        : items,
  })).sort((left, right) => {
    if (left.year === null) return 1;
    if (right.year === null) return -1;
    return right.year - left.year;
  });
}

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const sort = one(query.sort) === "title" ? "title" : "newest";
  const filters: PublicationFilters = {
    q: one(query.q),
    year: one(query.year),
    type: one(query.type),
    theme: one(query.theme),
    area: one(query.area),
    researcher: one(query.researcher),
    venue: one(query.venue),
    sort,
  };
  const { publications, facets } = await getPublications(filters);
  const groups = publicationGroups(publications, sort);
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== "sort" && Boolean(value),
  );
  const exportHref = `data:text/plain;charset=utf-8,${encodeURIComponent(
    publications.map(bibtexFor).join("\n\n"),
  )}`;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Publications</h1>
        <p className={styles.lead}>
          Papers, preprints, reports, and other scholarly outputs from the lab.
        </p>
      </header>

      <PublicationFilterForm className={styles.filterForm}>
        <div className={styles.filterField}>
          <label htmlFor="publication-search">Search publications</label>
          <input
            id="publication-search"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Title, abstract, author, or venue"
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="publication-year">Year</label>
          <select id="publication-year" name="year" defaultValue={filters.year}>
            <option value="">All years</option>
            {facets.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="publication-type">Type</label>
          <select id="publication-type" name="type" defaultValue={filters.type}>
            <option value="">All types</option>
            {facets.types.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="publication-theme">Theme</label>
          <select
            id="publication-theme"
            name="theme"
            defaultValue={filters.theme}
          >
            <option value="">All themes</option>
            {facets.themes.map((theme) => (
              <option key={theme.slug} value={theme.slug}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="publication-area">Area</label>
          <select id="publication-area" name="area" defaultValue={filters.area}>
            <option value="">All areas</option>
            {facets.areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="publication-researcher">Researcher</label>
          <select
            id="publication-researcher"
            name="researcher"
            defaultValue={filters.researcher}
          >
            <option value="">All researchers</option>
            {facets.researchers.map((researcher) => (
              <option key={researcher.slug} value={researcher.slug}>
                {researcher.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="publication-venue">Venue</label>
          <select
            id="publication-venue"
            name="venue"
            defaultValue={filters.venue}
          >
            <option value="">All venues</option>
            {facets.venues.map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="publication-sort">Sort</label>
          <select id="publication-sort" name="sort" defaultValue={sort}>
            <option value="newest">Newest</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className={styles.filterActions}>
          <button type="submit">Apply filters</button>
          {hasFilters ? (
            <Link href="/publications" transitionTypes={["publication-filter"]}>
              Clear
            </Link>
          ) : null}
        </div>
      </PublicationFilterForm>

      {publications.length > 0 ? (
        <>
          <div className={styles.resultHeader}>
            <p>
              {publications.length} public{" "}
              {publications.length === 1 ? "entry" : "entries"}
            </p>
            <a
              className={styles.exportLink}
              href={exportHref}
              download="sandhi-publications.bib"
            >
              Export BibTeX
            </a>
          </div>
          {groups.map((group) => (
            <section
              className={styles.yearGroup}
              key={group.year ?? "undated"}
              aria-labelledby={`publications-${group.year ?? "undated"}`}
            >
              <h2
                className={styles.yearHeading}
                id={`publications-${group.year ?? "undated"}`}
              >
                {group.year ?? "Undated"}
              </h2>
              {group.items.map((publication) => (
                <PublicationEntry
                  key={publication.id}
                  publication={publication}
                />
              ))}
            </section>
          ))}
        </>
      ) : (
        <ContentEmptyState
          message={
            hasFilters
              ? "No public publications match these filters."
              : "Our first papers are in progress."
          }
          action={
            hasFilters
              ? { href: "/publications", label: "Clear filters" }
              : undefined
          }
        />
      )}
    </div>
  );
}
