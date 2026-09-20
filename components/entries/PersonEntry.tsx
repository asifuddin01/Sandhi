import Link from "next/link";

import styles from "@/components/public/ResearchPages.module.css";
import { rankLabel } from "@/lib/member-rank";
import type { PersonSummary } from "@/lib/public-research";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PersonPortrait({ person }: { person: PersonSummary }) {
  return (
    <div className={styles.portrait}>
      {person.photoUrl ? (
        // R2's public host is configured at runtime, so Next Image cannot know it at build time.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photoUrl}
          alt={person.photoAlt}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span aria-hidden="true">{initials(person.name)}</span>
      )}
    </div>
  );
}

export function PersonEntry({ person }: { person: PersonSummary }) {
  return (
    <article className={styles.personEntry}>
      <PersonPortrait person={person} />
      <h3>
        <Link href={`/people/${person.slug}`}>{person.name}</Link>
      </h3>
      <p className={styles.rank}>{rankLabel(person.rank)}</p>
      {person.interests.length > 0 ? (
        <ul className={styles.interestList} aria-label="Research interests">
          {person.interests.slice(0, 3).map((interest) => (
            <li key={interest}>{interest}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
