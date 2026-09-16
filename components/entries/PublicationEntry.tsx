import Link from "next/link";

import { BibtexPanel } from "@/components/entries/BibtexPanel";
import { generateBibtex } from "@/lib/bibtex";
import {
  humanizeEnum,
  type PublicPublicationSummary,
} from "@/lib/public-content";

import styles from "./Entries.module.css";

export interface PublicationEntryProps {
  publication: PublicPublicationSummary;
  headingLevel?: "h2" | "h3";
}

function arxivUrl(arxivId: string): string {
  const canonicalId = arxivId.replace(/^arxiv:\s*/iu, "").trim();
  return `https://arxiv.org/abs/${encodeURIComponent(canonicalId)}`;
}

export function PublicationEntry({
  publication,
  headingLevel = "h3",
}: PublicationEntryProps) {
  const Heading = headingLevel;
  const bibtex = generateBibtex({
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
  const paperUrl =
    publication.pageUrl ??
    (publication.doi ? `https://doi.org/${publication.doi}` : null) ??
    publication.pdfUrl;
  const hasContributionLegend = publication.authors.some(
    (author) => author.equalContribution || author.corresponding,
  );

  return (
    <article className={styles.publicationEntry}>
      <div className={styles.entryMarker} aria-hidden="true">
        <span />
      </div>
      <div className={styles.entryBody}>
        <div className={styles.entryMeta}>
          <span>{humanizeEnum(publication.type)}</span>
          {(publication.venueShort ?? publication.venueName) ? (
            <span>{publication.venueShort ?? publication.venueName}</span>
          ) : null}
          {publication.year ? <span>{publication.year}</span> : null}
        </div>
        <Heading className={styles.entryTitle}>
          <Link href={`/publications/${publication.slug}`}>
            {publication.title}
          </Link>
        </Heading>
        {publication.authors.length > 0 ? (
          <p className={styles.authors}>
            {publication.authors.map((author, index) => (
              <span key={`${author.name}-${index}`}>
                {index > 0 ? ", " : null}
                {author.member ? (
                  <Link href={`/people/${author.member.slug}`}>
                    {author.name}
                  </Link>
                ) : (
                  author.name
                )}
                {author.equalContribution ? (
                  <sup aria-label="equal contribution">*</sup>
                ) : null}
                {author.corresponding ? (
                  <sup aria-label="corresponding author">†</sup>
                ) : null}
              </span>
            ))}
          </p>
        ) : null}
        {hasContributionLegend ? (
          <p className={styles.authorLegend}>
            {publication.authors.some((author) => author.equalContribution)
              ? "* Equal contribution. "
              : null}
            {publication.authors.some((author) => author.corresponding)
              ? "† Corresponding author."
              : null}
          </p>
        ) : null}
        {publication.award ? (
          <p className={styles.award}>{publication.award}</p>
        ) : null}
        <div className={styles.entryLinks} aria-label="Publication links">
          {paperUrl ? (
            <a href={paperUrl} rel="noreferrer">
              Paper
            </a>
          ) : null}
          {publication.arxivId ? (
            <a href={arxivUrl(publication.arxivId)} rel="noreferrer">
              arXiv
            </a>
          ) : null}
          {publication.codeUrl ? (
            <a href={publication.codeUrl} rel="noreferrer">
              Code
            </a>
          ) : null}
          {publication.datasetUrl ? (
            <a href={publication.datasetUrl} rel="noreferrer">
              Dataset
            </a>
          ) : null}
          {publication.project ? (
            <Link href={`/projects/${publication.project.slug}`}>Project</Link>
          ) : null}
        </div>
        <BibtexPanel bibtex={bibtex} />
      </div>
    </article>
  );
}
