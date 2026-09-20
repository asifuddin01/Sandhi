import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MemberAdminBar } from "@/components/entries/MemberAdminBar";
import { PersonPortrait } from "@/components/entries/PersonEntry";
import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { rankLabel } from "@/lib/member-rank";
import { can } from "@/lib/permissions";
import { publicAreaWhere } from "@/lib/visibility";
import { ProjectEntry } from "@/components/entries/ProjectEntry";
import { PublicationEntries } from "@/components/entries/PublicationEntries";
import { ConnectionsMini } from "@/components/graph/ConnectionsMini";
import { EmptyState } from "@/components/public/EmptyState";
import styles from "@/components/public/ResearchPages.module.css";
import { Prose } from "@/components/Prose";
import { getPersonBySlug } from "@/lib/public-research";

export const dynamic = "force-dynamic";

interface PersonPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PersonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);

  if (!person) return { title: "Researcher not found" };

  return {
    title: person.name,
    description:
      person.bio ?? `${rankLabel(person.rank)} at SANDHI Research Lab.`,
    alternates: { canonical: `/people/${person.slug}` },
  };
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) notFound();

  const areaByName = new Map(
    person.areas.map((area) => [area.name.toLocaleLowerCase(), area]),
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    url: `https://sandhiresearch.org/people/${person.slug}`,
    ...(person.photoUrl ? { image: person.photoUrl } : {}),
    ...(person.title
      ? { jobTitle: person.title }
      : { jobTitle: rankLabel(person.rank) }),
    ...(person.orgEmail ? { email: person.orgEmail } : {}),
    ...(person.links.length > 0
      ? { sameAs: person.links.map((link) => link.href) }
      : {}),
    affiliation: {
      "@type": "ResearchOrganization",
      name: "SANDHI Research Lab",
      url: "https://sandhiresearch.org",
    },
  };

  // Only asked for when somebody can act on the answer.
  const viewer = await getViewer();
  const manages = Boolean(viewer && can(viewer.role, "members:manage"));
  const management =
    manages && isDatabaseConfigured()
      ? await managementData(person.slug)
      : null;

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c"),
        }}
      />

      {management ? (
        <MemberAdminBar
          slug={person.slug}
          name={person.name}
          rank={person.rank}
          areas={management.areas}
          allAreas={management.allAreas}
        />
      ) : null}

      <header className={styles.profileHero}>
        <PersonPortrait person={person} />
        <div className={styles.profileHeading}>
          <h1>{person.name}</h1>
          <p className={styles.rank}>
            {person.title ?? rankLabel(person.rank)}
          </p>
          {person.bio ? (
            <Prose className={styles.prose}>{person.bio}</Prose>
          ) : null}
          {person.links.length > 0 || person.orgEmail ? (
            <div className={styles.profileLinks}>
              {person.links.map((link) => (
                <a
                  className={styles.textLink}
                  href={link.href}
                  key={link.label}
                >
                  {link.label}
                </a>
              ))}
              {person.orgEmail ? (
                <a
                  className={styles.textLink}
                  href={`mailto:${person.orgEmail}`}
                >
                  {person.orgEmail}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <ConnectionsMini
        center={{ label: person.name, href: `/people/${person.slug}` }}
        groups={[
          {
            label: "Research areas",
            connections: person.areas.map((area) => ({
              label: area.name,
              href: `/research/areas/${area.slug}`,
            })),
          },
          {
            label: "Projects",
            connections: person.projects.map((project) => ({
              label: project.title,
              href: `/projects/${project.slug}`,
            })),
          },
          {
            label: "Publications",
            connections: person.publications.map((publication) => ({
              label: publication.title,
              href: `/publications/${publication.slug}`,
            })),
          },
        ]}
      />

      <section className={styles.section} aria-labelledby="interests-heading">
        <div className={styles.sectionHeader}>
          <h2 id="interests-heading">Research interests</h2>
        </div>
        {person.interests.length > 0 ? (
          <ul className={styles.interestList}>
            {person.interests.map((interest) => {
              const area = areaByName.get(interest.toLocaleLowerCase());
              return (
                <li key={interest}>
                  {area ? (
                    <Link
                      className={styles.textLink}
                      href={`/research/areas/${area.slug}`}
                    >
                      {interest}
                    </Link>
                  ) : (
                    interest
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>Research interests are being prepared.</EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="projects-heading">
        <div className={styles.sectionHeader}>
          <h2 id="projects-heading">Projects</h2>
        </div>
        {person.projects.length > 0 ? (
          <div className={styles.entryList}>
            {person.projects.map((project) => (
              <ProjectEntry
                key={project.slug}
                project={project}
                headingLevel="h3"
              />
            ))}
          </div>
        ) : (
          <EmptyState>No public projects are linked yet.</EmptyState>
        )}
      </section>

      <section
        className={styles.section}
        aria-labelledby="publications-heading"
      >
        <div className={styles.sectionHeader}>
          <h2 id="publications-heading">Publications</h2>
        </div>
        {person.publications.length > 0 ? (
          <PublicationEntries publications={person.publications} />
        ) : (
          <EmptyState>No public publications are linked yet.</EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="notes-heading">
        <div className={styles.sectionHeader}>
          <h2 id="notes-heading">Research notes</h2>
        </div>
        {person.notes.length > 0 ? (
          <ol className={styles.notesList}>
            {person.notes.map((note) => (
              <li key={note.slug}>
                <h3>
                  <Link href={`/insights/${note.slug}`}>{note.title}</Link>
                </h3>
                <p>{note.summary}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState>Research notes will appear here.</EmptyState>
        )}
      </section>
    </div>
  );
}

/** What the profile's own administration controls need, and nothing else. */
async function managementData(slug: string) {
  const db = getDb();
  const [member, allAreas] = await Promise.all([
    db.member.findUnique({
      where: { slug },
      select: {
        areas: {
          orderBy: { area: { sortOrder: "asc" } },
          select: {
            isLead: true,
            area: { select: { slug: true, name: true } },
          },
        },
      },
    }),
    db.researchArea.findMany({
      where: publicAreaWhere,
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  return {
    areas: (member?.areas ?? []).map((held) => ({
      slug: held.area.slug,
      name: held.area.name,
      isLead: held.isLead,
    })),
    allAreas,
  };
}
