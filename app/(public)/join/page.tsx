import type { Metadata } from "next";

import { JoinForm } from "@/components/forms/JoinForm";
import { resolveOpenOpportunity } from "@/lib/forms-opportunity";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Join SANDHI",
  description:
    "Introduce yourself to SANDHI Research Lab as a researcher, intern, or collaborator.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string | string[] }>;
}) {
  const query = await searchParams;
  const requested = Array.isArray(query.opportunity)
    ? query.opportunity[0]
    : query.opportunity;
  const validSlug =
    requested && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requested)
      ? requested
      : undefined;
  const opportunity = validSlug
    ? await resolveOpenOpportunity(validSlug)
    : null;

  return (
    <div className={styles.page}>
      <header className={`page-shell ${styles.header}`}>
        <h1>Begin at the junction.</h1>
        <p className={styles.lead}>
          Tell us what you hope to explore, what you bring, and where our work
          might meet.
        </p>
      </header>
      <section
        className={`page-shell ${styles.formSection}`}
        aria-label="Application form"
      >
        <JoinForm
          siteKey={process.env.TURNSTILE_SITE_KEY}
          opportunity={opportunity ?? undefined}
          requestedOpportunity={validSlug}
        />
      </section>
    </div>
  );
}
