import type { Metadata } from "next";

import { ProposalForm } from "@/components/forms/ProposalForm";
import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { publicAreaWhere } from "@/lib/visibility";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Propose research",
  description:
    "Send SANDHI Research Lab a research proposal. Anyone may: members, students, and colleagues at other institutions.",
  alternates: { canonical: "/proposals" },
};

async function researchAreas() {
  if (!isDatabaseConfigured()) return [];
  return getDb().researchArea.findMany({
    where: publicAreaWhere,
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true },
  });
}

export default async function ProposalsPage() {
  const [areas, viewer] = await Promise.all([researchAreas(), getViewer()]);
  const signedInAs =
    viewer && viewer.member
      ? { name: viewer.member.name, email: viewer.email }
      : null;

  return (
    <div className={styles.page}>
      <header className={`page-shell ${styles.header}`}>
        <h1>Propose research</h1>
        <p className={styles.lead}>
          An idea worth working on can come from anywhere. Send us yours: a
          reviewer reads every one, and the ones we take up are posted to the
          lab so people can say they would work on them.
        </p>
      </header>

      <div className={`page-shell ${styles.layout}`}>
        <section className={styles.aside} aria-labelledby="what-happens">
          <h2 id="what-happens">What happens to it</h2>
          <ol className={styles.steps}>
            <li>
              <strong>A reviewer reads it.</strong> Someone on the lab&rsquo;s
              review side picks it up.
            </li>
            <li>
              <strong>It is queued or sent back.</strong> A queued proposal is
              one we think is worth doing, waiting for the people to do it.
            </li>
            <li>
              <strong>The lab sees it.</strong> Members say whether they would
              work on it. That is how teams here get formed.
            </li>
            <li>
              <strong>An administrator approves it.</strong> It becomes a
              project with a team and a research lead.
            </li>
          </ol>
          <p className={styles.note}>
            We cannot take up everything, and a proposal that is not taken up
            stays yours. Nothing you send here is published without you.
          </p>
        </section>

        <ProposalForm
          siteKey={process.env.TURNSTILE_SITE_KEY}
          areas={areas}
          signedInAs={signedInAs}
        />
      </div>
    </div>
  );
}
