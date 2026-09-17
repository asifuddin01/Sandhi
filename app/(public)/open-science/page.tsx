import type { Metadata } from "next";

import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";

export const metadata: Metadata = {
  title: "Open science",
  description:
    "How SANDHI approaches code, data, models, reproducibility, evaluation, and responsible data sharing.",
  alternates: { canonical: "/open-science" },
};

const commitments = [
  [
    "Code",
    "We release the code behind our published work, with instructions to reproduce the main results.",
  ],
  [
    "Data",
    "Where licensing and privacy allow, we release datasets and document how they were collected and processed.",
  ],
  [
    "Models",
    "We release trained models when doing so is safe and useful, with clear documentation of their limits.",
  ],
  [
    "Reproducibility",
    "We report seeds, splits, hardware, and hyperparameters, and we publish reproducibility reports on our own work.",
  ],
  [
    "Evaluation",
    "We compare against strong baselines on identical splits and report where our methods fail.",
  ],
  [
    "Medical and biological data",
    "We follow the data use agreements of every dataset we use and never release data we are not permitted to share.",
  ],
] as const;

export default function OpenSciencePage() {
  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      <PageIntro title="Open science" />
      {commitments.map(([title, body]) => {
        const headingId = `open-science-${title
          .toLocaleLowerCase("en")
          .replace(/[^a-z0-9]+/gu, "-")}`;
        return (
          <section
            className={styles.section}
            aria-labelledby={headingId}
            key={title}
          >
            <div className={styles.sectionHeader}>
              <h2 id={headingId}>{title}</h2>
            </div>
            <div className={styles.prose}>
              <p>{body}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
