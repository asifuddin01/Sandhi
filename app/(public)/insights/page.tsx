import type { Metadata } from "next";
import Link from "next/link";

import { InsightEntry } from "@/components/entries/InsightEntry";
import { ContentEmptyState } from "@/components/entries/ContentEmptyState";
import {
  INSIGHT_KIND_LABELS,
  INSIGHT_KINDS,
} from "@/lib/insight-content";
import { getPublicInsights } from "@/lib/public-insights";

import styles from "../ContentPages.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Research notes, explanations, and reproducibility reports from SANDHI Research Lab.",
  alternates: { canonical: "/insights" },
  openGraph: {
    title: "Insights | SANDHI Research Lab",
    description:
      "Research notes, explanations, and reproducibility reports from SANDHI Research Lab.",
    url: "/insights",
    type: "website",
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const requestedKind = first(query.kind);
  const kind = INSIGHT_KINDS.find((item) => item === requestedKind);
  const insights = await getPublicInsights(kind);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Insights</h1>
        <p className={styles.lead}>
          Not every useful result is a paper. Research notes, explanations, and
          reproducibility reports from the lab.
        </p>
      </header>

      <nav className={styles.categoryNav} aria-label="Insight kinds">
        <Link href="/insights" data-active={!kind}>
          All
        </Link>
        {INSIGHT_KINDS.map((item) => (
          <Link
            href={`/insights?kind=${item}`}
            data-active={kind === item}
            key={item}
          >
            {INSIGHT_KIND_LABELS[item]}
          </Link>
        ))}
      </nav>

      {insights.length > 0 ? (
        <div aria-label="Published insights">
          {insights.map((insight) => (
            <InsightEntry insight={insight} key={insight.id} />
          ))}
        </div>
      ) : (
        <ContentEmptyState
          message={
            kind
              ? `No public ${INSIGHT_KIND_LABELS[kind].toLocaleLowerCase("en")} notes are available.`
              : "Research notes from the lab will appear here."
          }
          action={
            kind ? { href: "/insights", label: "View all insights" } : undefined
          }
        />
      )}
    </div>
  );
}
