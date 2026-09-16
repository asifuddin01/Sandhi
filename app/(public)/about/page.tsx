import type { Metadata } from "next";

import { PersonEntry } from "@/components/entries/PersonEntry";
import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { getAboutData } from "@/lib/public-research";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About SANDHI",
  description:
    "The mission, values, working method, and history of SANDHI Research Lab.",
  alternates: { canonical: "/about" },
};

const workingMethod = [
  "Identify meaningful and challenging research questions.",
  "Study existing knowledge and find the gaps.",
  "Develop new models, methods, algorithms, and systems.",
  "Experiment systematically across datasets, models, and settings.",
  "Evaluate rigorously through reproducible experiments and meaningful benchmarks.",
  "Collaborate across research areas and with researchers beyond SANDHI.",
  "Publish through papers, technical reports, datasets, benchmarks, and open-source tools.",
  "Contribute knowledge that the wider community can build on.",
] as const;

const values = [
  ["Curiosity", "We follow questions, not trends."],
  ["Rigor", "We distrust results we cannot explain."],
  ["Openness", "We share methods, code, and data wherever we can."],
  ["Reproducibility", "Every claim should be checkable by someone else."],
  ["Collaboration", "We think better together, across fields."],
  ["Contribution", "We measure our work by what it adds."],
] as const;

export default async function AboutPage() {
  const { milestones, leadership } = await getAboutData();

  return (
    <div className={styles.page}>
      <PageIntro
        title="About SANDHI"
        lead="SANDHI Research Lab is an independent research organization advancing artificial intelligence and computational methods through interdisciplinary research."
      />

      <section className={styles.section} aria-labelledby="name-heading">
        <span className={styles.glyph} lang="sa" aria-hidden="true">
          सन्धि
        </span>
        <div className={styles.sectionHeader}>
          <h2 id="name-heading">The name</h2>
        </div>
        <div className={styles.prose}>
          <p>
            <i>Sandhi</i> (<span lang="sa">सन्धि</span>) is a Sanskrit word
            meaning joining, connection, union, or junction. It names our core
            belief: meaningful discoveries often emerge where different ideas,
            disciplines, and perspectives meet.
          </p>
        </div>
        <blockquote className={styles.epigraph}>
          “Truth is one; the wise speak of it in many ways.”
          <cite>Ṛgveda 1.164.46</cite>
        </blockquote>
      </section>

      <section className={styles.section} aria-labelledby="mission-heading">
        <div className={styles.sectionHeader}>
          <h2 id="mission-heading">Mission</h2>
        </div>
        <div className={styles.prose}>
          <p>
            To investigate meaningful questions in artificial intelligence and
            computational science, develop new methods, and contribute rigorous,
            reproducible knowledge to the research community.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="vision-heading">
        <div className={styles.sectionHeader}>
          <h2 id="vision-heading">Vision</h2>
        </div>
        <div className={styles.prose}>
          <p>
            A research community where fields do not work in isolation, and
            where the connections between vision, language, learning, and
            science lead to understanding that none of them could reach alone.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="definition-heading">
        <div className={styles.sectionHeader}>
          <h2 id="definition-heading">What defines us</h2>
        </div>
        <div className={styles.prose}>
          <p>
            We do not want to be defined by a particular model, architecture, or
            technology. We want to be defined by the questions we pursue and the
            knowledge we contribute.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="method-heading">
        <div className={styles.sectionHeader}>
          <h2 id="method-heading">How we work</h2>
        </div>
        <ol className={styles.sequence}>
          {workingMethod.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="values-heading">
        <div className={styles.sectionHeader}>
          <h2 id="values-heading">Values</h2>
        </div>
        <dl className={styles.definitionGrid}>
          {values.map(([term, description]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="timeline-heading">
        <div className={styles.sectionHeader}>
          <h2 id="timeline-heading">Timeline</h2>
        </div>
        {milestones.length > 0 ? (
          <ol className={styles.timeline}>
            {milestones.map((milestone) => {
              const date = new Date(milestone.date);
              return (
                <li key={milestone.id}>
                  <time dateTime={milestone.date}>{date.getUTCFullYear()}</time>
                  <div>
                    <h3>{milestone.title}</h3>
                    {milestone.body ? <p>{milestone.body}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState>The lab timeline is being prepared.</EmptyState>
        )}
      </section>

      <section className={styles.section} aria-labelledby="leadership-heading">
        <div className={styles.sectionHeader}>
          <h2 id="leadership-heading">Leadership</h2>
        </div>
        {leadership.length > 0 ? (
          <div className={styles.personGrid}>
            {leadership.map((person) => (
              <PersonEntry key={person.slug} person={person} />
            ))}
          </div>
        ) : (
          <EmptyState>Leadership profiles are being prepared.</EmptyState>
        )}
      </section>
    </div>
  );
}
