import type { Metadata } from "next";
import Link from "next/link";

import { PersonEntry } from "@/components/entries/PersonEntry";
import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { emptyStateCopy } from "@/content/strings";
import { getPeopleIndex, type PersonSummary } from "@/lib/public-research";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "People",
  description: "The researchers of SANDHI Research Lab.",
  alternates: { canonical: "/people" },
};

interface PeoplePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const groups: Array<{
  title: string;
  matches: (person: PersonSummary) => boolean;
}> = [
  {
    title: "Leadership",
    matches: (person) =>
      person.status !== "ALUMNI" &&
      ["DIRECTOR", "RESEARCH_LEAD"].includes(person.rank),
  },
  {
    title: "Researchers",
    matches: (person) =>
      person.status !== "ALUMNI" && person.rank === "RESEARCHER",
  },
  {
    title: "Research assistants",
    matches: (person) =>
      person.status !== "ALUMNI" && person.rank === "RESEARCH_ASSISTANT",
  },
  {
    title: "Interns",
    matches: (person) => person.status !== "ALUMNI" && person.rank === "INTERN",
  },
  {
    title: "Collaborators",
    matches: (person) =>
      person.status !== "ALUMNI" && person.rank === "COLLABORATOR",
  },
  {
    title: "Alumni",
    matches: (person) => person.status === "ALUMNI",
  },
];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const query = await searchParams;
  const selectedArea = firstValue(query.area);
  const { people, areas } = await getPeopleIndex(selectedArea);

  return (
    <div className={styles.page}>
      <PageIntro title="People" lead="The researchers of SANDHI." />

      <form className={styles.filterForm} action="/people" method="get">
        <label className={styles.filterField}>
          Research area
          <select name="area" defaultValue={selectedArea ?? ""}>
            <option value="">All areas</option>
            {areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.filterActions}>
          <button className={styles.filterSubmit} type="submit">
            Apply filter
          </button>
          {selectedArea ? (
            <Link className={styles.textLink} href="/people">
              Clear filter
            </Link>
          ) : null}
        </div>
      </form>

      {people.length > 0 ? (
        groups.map((group) => {
          const groupedPeople = people.filter(group.matches);
          if (groupedPeople.length === 0) return null;

          const headingId = `${group.title.toLowerCase().replaceAll(" ", "-")}-heading`;
          return (
            <section
              className={styles.section}
              aria-labelledby={headingId}
              key={group.title}
            >
              <div className={styles.sectionHeader}>
                <h2 id={headingId}>{group.title}</h2>
              </div>
              <div className={styles.personGrid}>
                {groupedPeople.map((person) => (
                  <PersonEntry key={person.slug} person={person} />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <EmptyState href="/join" linkLabel="Join SANDHI">
          {selectedArea
            ? "No public profiles match this research area."
            : emptyStateCopy.people}
        </EmptyState>
      )}
    </div>
  );
}
