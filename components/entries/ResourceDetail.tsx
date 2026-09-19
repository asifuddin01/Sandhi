import Link from "next/link";

import { BibtexPanel } from "@/components/entries/BibtexPanel";
import { Prose } from "@/components/Prose";
import styles from "@/components/public/OpportunityResourcePages.module.css";
import {
  RESOURCE_KIND_LABELS,
  type PublicResourceDetail,
} from "@/lib/public-resources";

/** A resource as visitors see it; the admin preview renders it too. */
export function ResourceDetail({
  resource,
}: {
  resource: PublicResourceDetail;
}) {
  const links = [
    ["Download", resource.downloadUrl],
    ["Repository", resource.repoUrl],
    ["Documentation", resource.docsUrl],
    ["Hugging Face", resource.hfUrl],
  ].filter((link): link is [string, string] => Boolean(link[1]));

  return (
    <article className={styles.detailPage}>
      <header className={styles.detailHeader}>
        <Link className={styles.backLink} href="/resources">
          Resources
        </Link>
        <h1>{resource.name}</h1>
        <div className={styles.detailMeta}>
          <span>{RESOURCE_KIND_LABELS[resource.kind]}</span>
          {resource.version ? <span>Version {resource.version}</span> : null}
          {resource.license ? <span>{resource.license}</span> : null}
        </div>
        {links.length > 0 ? (
          <ul className={styles.linkList} aria-label="Resource links">
            {links.map(([label, href]) => (
              <li key={label}>
                <a href={href} rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.detailMain}>
          <section
            className={styles.detailSection}
            aria-labelledby="description-heading"
          >
            <h2 id="description-heading">Description</h2>
            <Prose className={styles.prose}>{resource.description}</Prose>
          </section>

          {resource.bibtex ? (
            <section
              className={styles.detailSection}
              aria-labelledby="citation-heading"
            >
              <h2 id="citation-heading">Citation</h2>
              <BibtexPanel bibtex={resource.bibtex} />
            </section>
          ) : null}

          {resource.changelog ? (
            <section
              className={styles.detailSection}
              aria-labelledby="changelog-heading"
            >
              <h2 id="changelog-heading">Changelog</h2>
              <Prose className={styles.prose}>{resource.changelog}</Prose>
            </section>
          ) : null}
        </div>

        {resource.project ||
        resource.publication ||
        resource.areas.length > 0 ? (
          <aside className={styles.detailAside} aria-label="Related research">
            {resource.project ? (
              <section>
                <h2>Related project</h2>
                <Link
                  className={styles.relatedLink}
                  href={`/projects/${resource.project.slug}`}
                >
                  {resource.project.title}
                </Link>
              </section>
            ) : null}

            {resource.publication ? (
              <section>
                <h2>Related publication</h2>
                <Link
                  className={styles.relatedLink}
                  href={`/publications/${resource.publication.slug}`}
                >
                  {resource.publication.title}
                </Link>
              </section>
            ) : null}

            {resource.areas.length > 0 ? (
              <section>
                <h2>Research areas</h2>
                <ul className={styles.areaList}>
                  {resource.areas.map((area) => (
                    <li key={area.slug}>
                      <Link href={`/research/areas/${area.slug}`}>
                        {area.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </article>
  );
}
