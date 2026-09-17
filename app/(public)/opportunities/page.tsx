import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/OpportunityResourcePages.module.css";
import {
  getPublicOpportunities,
  OPPORTUNITIES_EMPTY,
  OPPORTUNITIES_LEAD,
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_KINDS,
  opportunityClosingLabel,
  opportunityLocationLabel,
} from "@/lib/public-opportunities";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opportunities",
  description: OPPORTUNITIES_LEAD,
  alternates: { canonical: "/opportunities" },
};

export default async function OpportunitiesPage() {
  const opportunities = await getPublicOpportunities();

  return (
    <div className={styles.page}>
      <PageIntro title="Opportunities" lead={OPPORTUNITIES_LEAD} />

      {opportunities.length === 0 ? (
        <EmptyState href="/join" linkLabel="Join SANDHI">
          {OPPORTUNITIES_EMPTY}
        </EmptyState>
      ) : (
        OPPORTUNITY_KINDS.map((kind) => {
          const group = opportunities.filter(
            (opportunity) => opportunity.kind === kind,
          );
          const headingId = `${kind.toLowerCase().replaceAll("_", "-")}-heading`;

          return (
            <section
              className={styles.group}
              aria-labelledby={headingId}
              key={kind}
            >
              <div className={styles.groupHeader}>
                <h2 id={headingId}>{OPPORTUNITY_KIND_LABELS[kind]}</h2>
              </div>

              {group.length > 0 ? (
                <div className={styles.entryList}>
                  {group.map((opportunity) => {
                    const closing = opportunityClosingLabel(
                      opportunity.deadline,
                    );
                    return (
                      <article className={styles.entry} key={opportunity.slug}>
                        <div>
                          <h3>
                            <Link href={`/opportunities/${opportunity.slug}`}>
                              {opportunity.title}
                            </Link>
                          </h3>
                          {opportunity.areas.length > 0 ? (
                            <ul
                              className={styles.areaList}
                              aria-label="Research areas"
                            >
                              {opportunity.areas.map((area) => (
                                <li key={area.slug}>
                                  <Link href={`/research/areas/${area.slug}`}>
                                    {area.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div className={styles.entryMeta}>
                          <p>{opportunityLocationLabel(opportunity)}</p>
                          {opportunity.duration ? (
                            <p>{opportunity.duration}</p>
                          ) : null}
                          {closing ? <p>{closing}</p> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyCategory}>
                  <p>No current openings in this category.</p>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
