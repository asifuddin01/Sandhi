import Link from "next/link";

import styles from "@/app/(public)/ContentPages.module.css";
import { BibtexPanel } from "@/components/entries/BibtexPanel";
import { SharedEntityTitle } from "@/components/motion/SharedEntityTitle";
import { Prose } from "@/components/Prose";
import { generateBibtex } from "@/lib/bibtex";
import {
  humanizeEnum,
  serializeJsonLd,
  type PublicPublicationDetail,
} from "@/lib/public-content";

function arxivUrl(arxivId: string): string {
  const canonicalId = arxivId.replace(/^arxiv:\s*/iu, "").trim();
  return `https://arxiv.org/abs/${encodeURIComponent(canonicalId)}`;
}

/** A publication as visitors see it; the admin preview renders it too. */
export function PublicationDetail({
  publication,
}: {
  publication: PublicPublicationDetail;
}) {
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
  const canonicalUrl = `https://sandhiresearch.org/publications/${publication.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: publication.title,
    abstract: publication.abstract,
    url: canonicalUrl,
    datePublished:
      publication.publishedAt?.toISOString() ??
      (publication.year ? `${publication.year}` : undefined),
    dateModified: publication.updatedAt.toISOString(),
    author: publication.authors.map((author) => ({
      "@type": "Person",
      name: author.name,
      ...(author.member
        ? { url: `https://sandhiresearch.org/people/${author.member.slug}` }
        : {}),
      ...(author.affiliation
        ? { affiliation: { "@type": "Organization", name: author.affiliation } }
        : {}),
    })),
    publisher: {
      "@type": "ResearchOrganization",
      name: "SANDHI Research Lab",
      url: "https://sandhiresearch.org",
    },
    ...(publication.doi
      ? { identifier: `https://doi.org/${publication.doi}` }
      : {}),
    ...(publication.pdfUrl
      ? { encoding: { "@type": "MediaObject", contentUrl: publication.pdfUrl } }
      : {}),
    about: publication.areas.map((area) => ({
      "@type": "Thing",
      name: area.name,
      url: `https://sandhiresearch.org/research/areas/${area.slug}`,
    })),
  };
  const breadcrumbsJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Publications",
        item: "https://sandhiresearch.org/publications",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: publication.title,
        item: canonicalUrl,
      },
    ],
  };
  const paperUrl =
    publication.pageUrl ??
    (publication.doi ? `https://doi.org/${publication.doi}` : null) ??
    publication.pdfUrl;

  return (
    <article className={styles.detailPage}>
      <script
        id="publication-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
      />
      <script
        id="publication-breadcrumb-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbsJsonLd) }}
      />

      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/publications">Publications</Link>
          </li>
          <li aria-current="page">{publication.title}</li>
        </ol>
      </nav>

      <header className={styles.detailHeader}>
        <SharedEntityTitle kind="publication" slug={publication.slug}>
          <h1>{publication.title}</h1>
        </SharedEntityTitle>
        <div className={styles.detailMeta}>
          <span>{humanizeEnum(publication.type)}</span>
          {publication.venueName ? <span>{publication.venueName}</span> : null}
          {publication.year ? <span>{publication.year}</span> : null}
          {publication.doi ? <span>DOI {publication.doi}</span> : null}
        </div>
        {publication.authors.length > 0 ? (
          <p className={styles.detailAuthors}>
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
                  <sup>
                    *
                    <span className="visually-hidden"> equal contribution</span>
                  </sup>
                ) : null}
                {author.corresponding ? (
                  <sup>
                    †
                    <span className="visually-hidden">
                      {" "}
                      corresponding author
                    </span>
                  </sup>
                ) : null}
                {author.affiliation ? (
                  <span className={styles.affiliation}>
                    {" "}
                    ({author.affiliation})
                  </span>
                ) : null}
              </span>
            ))}
          </p>
        ) : null}
        {publication.award ? <p>{publication.award}</p> : null}
        <div
          className={styles.detailLinks}
          role="group"
          aria-label="Publication links"
        >
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
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.articleBody}>
          <section
            className={styles.articleSection}
            aria-labelledby="abstract-title"
          >
            <h2 id="abstract-title">Abstract</h2>
            <Prose>{publication.abstract}</Prose>
          </section>
          <section
            className={styles.articleSection}
            aria-labelledby="bibtex-title"
          >
            <h2 id="bibtex-title">Citation</h2>
            <BibtexPanel bibtex={bibtex} />
          </section>
        </div>

        <aside className={styles.sidebar} aria-label="Publication connections">
          {publication.areas.length > 0 ? (
            <section className={styles.sidebarSection}>
              <h2>Research areas</h2>
              <ul>
                {publication.areas.map((area) => (
                  <li key={area.slug}>
                    <Link href={`/research/areas/${area.slug}`}>
                      {area.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {publication.project ? (
            <section className={styles.sidebarSection}>
              <h2>Linked project</h2>
              <p>
                <Link href={`/projects/${publication.project.slug}`}>
                  {publication.project.title}
                </Link>
              </p>
            </section>
          ) : null}
          {publication.resources.length > 0 ? (
            <section className={styles.sidebarSection}>
              <h2>Resources</h2>
              <ul>
                {publication.resources.map((resource) => (
                  <li key={resource.slug}>
                    <Link href={`/resources/${resource.slug}`}>
                      {resource.name}
                    </Link>
                    <span className={styles.sidebarMeta}>
                      {humanizeEnum(resource.kind)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {publication.relatedPublications.length > 0 ? (
            <section className={styles.sidebarSection}>
              <h2>Related publications</h2>
              <ul>
                {publication.relatedPublications.map((related) => (
                  <li key={related.slug}>
                    <Link href={`/publications/${related.slug}`}>
                      {related.title}
                    </Link>
                    {related.year ? (
                      <span className={styles.sidebarMeta}>{related.year}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
