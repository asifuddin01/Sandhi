import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/Prose";
import styles from "@/components/public/OpportunityResourcePages.module.css";
import {
  getPublicOpportunityBySlug,
  OPPORTUNITY_KIND_LABELS,
  opportunityClosingLabel,
  opportunityLocationLabel,
} from "@/lib/public-opportunities";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = await getPublicOpportunityBySlug(slug);
  if (!opportunity) {
    return {
      title: "Opportunity not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: opportunity.title,
    description: opportunity.description.replace(/\s+/gu, " ").slice(0, 160),
    alternates: { canonical: `/opportunities/${opportunity.slug}` },
  };
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export default async function OpportunityPage({ params }: PageProps) {
  const { slug } = await params;
  const opportunity = await getPublicOpportunityBySlug(slug);
  if (!opportunity) notFound();

  const closing = opportunityClosingLabel(opportunity.deadline);

  return (
    <article className={styles.detailPage}>
      <header className={styles.detailHeader}>
        <Link className={styles.backLink} href="/opportunities">
          Opportunities
        </Link>
        <h1>{opportunity.title}</h1>
        <div className={styles.detailMeta}>
          <span>{OPPORTUNITY_KIND_LABELS[opportunity.kind]}</span>
          <span>{opportunityLocationLabel(opportunity)}</span>
          {opportunity.duration ? <span>{opportunity.duration}</span> : null}
          {opportunity.deadline ? (
            <span>
              Deadline:{" "}
              <time dateTime={opportunity.deadline.toISOString()}>
                {dateFormatter.format(opportunity.deadline)}
              </time>
            </span>
          ) : null}
          {closing ? <span>{closing}</span> : null}
        </div>
        <Link
          className={styles.primaryAction}
          href={`/join?opportunity=${encodeURIComponent(opportunity.slug)}`}
        >
          Apply
        </Link>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.detailMain}>
          <section
            className={styles.detailSection}
            aria-labelledby="description-heading"
          >
            <h2 id="description-heading">Description</h2>
            <Prose className={styles.prose}>{opportunity.description}</Prose>
          </section>

          {opportunity.responsibilities.length > 0 ? (
            <section
              className={styles.detailSection}
              aria-labelledby="responsibilities-heading"
            >
              <h2 id="responsibilities-heading">Responsibilities</h2>
              <ul className={styles.plainList}>
                {opportunity.responsibilities.map((responsibility) => (
                  <li key={responsibility}>{responsibility}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {opportunity.requirements.length > 0 ? (
            <section
              className={styles.detailSection}
              aria-labelledby="requirements-heading"
            >
              <h2 id="requirements-heading">Requirements</h2>
              <ul className={styles.plainList}>
                {opportunity.requirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className={styles.detailAside} aria-label="Opportunity details">
          <section>
            <h2>Role details</h2>
            <dl className={styles.factList}>
              <div>
                <dt>Role</dt>
                <dd>{opportunity.title}</dd>
              </div>
              {opportunity.duration ? (
                <div>
                  <dt>Duration</dt>
                  <dd>{opportunity.duration}</dd>
                </div>
              ) : null}
              <div>
                <dt>Location</dt>
                <dd>{opportunityLocationLabel(opportunity)}</dd>
              </div>
            </dl>
          </section>

          {opportunity.areas.length > 0 ? (
            <section>
              <h2>Research areas</h2>
              <ul className={styles.areaList}>
                {opportunity.areas.map((area) => (
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
      </div>
    </article>
  );
}
