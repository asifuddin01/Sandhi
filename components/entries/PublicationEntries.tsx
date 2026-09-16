import Link from "next/link";

import { SharedEntityTitle } from "@/components/motion/SharedEntityTitle";
import styles from "@/components/public/ResearchPages.module.css";
import type { PublicationSummary } from "@/lib/public-research";

function publicationTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (first) => first.toUpperCase());
}

export function PublicationEntries({
  publications,
}: {
  publications: PublicationSummary[];
}) {
  return (
    <ol className={styles.notesList}>
      {publications.map((publication) => {
        const venue = publication.venueShort ?? publication.venueName;
        return (
          <li key={publication.slug}>
            <SharedEntityTitle kind="publication" slug={publication.slug}>
              <h3 className={styles.publicationTitle}>
                <Link
                  href={`/publications/${publication.slug}`}
                  transitionTypes={["entity-detail"]}
                >
                  {publication.title}
                </Link>
              </h3>
            </SharedEntityTitle>
            <p className={styles.publicationMeta}>
              {publication.authors.map((author, index) => (
                <span key={`${publication.slug}-${author.name}-${index}`}>
                  {author.memberSlug ? (
                    <Link href={`/people/${author.memberSlug}`}>
                      {author.name}
                    </Link>
                  ) : (
                    author.name
                  )}
                  {index < publication.authors.length - 1 ? ", " : ""}
                </span>
              ))}
              {publication.authors.length > 0 ? ". " : ""}
              {[venue, publication.year, publicationTypeLabel(publication.type)]
                .filter(Boolean)
                .join(", ")}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
