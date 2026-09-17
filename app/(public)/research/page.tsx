import type { Metadata } from "next";
import Link from "next/link";

import { ConnectionsMap } from "@/components/graph/ConnectionsMap";
import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { getPublicGraph } from "@/lib/public-graph";
import { getResearchIndex } from "@/lib/public-research";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Research themes and areas connecting vision, language, learning, and computational science at SANDHI.",
  alternates: { canonical: "/research" },
};

export default async function ResearchPage() {
  const [{ themes }, graph] = await Promise.all([
    getResearchIndex(),
    getPublicGraph(),
  ]);

  return (
    <div className={styles.page}>
      <PageIntro
        title="Research"
        lead="Our work is organized around five themes. Each theme gathers research areas that share a central question."
      />

      <section className={styles.section} aria-labelledby="map-heading">
        <div className={styles.sectionHeader}>
          <h2 id="map-heading">Map of connections</h2>
          <p>
            Follow the threads between themes, areas, projects, people, and
            publications.
          </p>
        </div>
        <ConnectionsMap initialData={graph} />
      </section>

      <section className={styles.section} aria-labelledby="themes-heading">
        <div className={styles.sectionHeader}>
          <h2 id="themes-heading">Research themes</h2>
          <p>Each theme gathers areas that share a central question.</p>
        </div>
        {themes.length > 0 ? (
          <ol className={styles.themeMap}>
            {themes.map((theme) => (
              <li
                className={styles.themeRow}
                data-center={theme.name === "Junction"}
                key={theme.slug}
              >
                <div className={styles.themeIdentity}>
                  <h3>
                    <Link href={`/research/${theme.slug}`}>{theme.name}</Link>
                  </h3>
                  <p>{theme.gloss}</p>
                </div>
                <ol className={styles.areaList}>
                  {theme.areas.map((area) => (
                    <li key={area.slug}>
                      <h4>
                        <Link href={`/research/areas/${area.slug}`}>
                          {area.name}
                        </Link>
                      </h4>
                      <p className={styles.areaSummary}>{area.summary}</p>
                    </li>
                  ))}
                </ol>
                <div className={styles.themeCounts}>
                  {theme.projectCount > 0 ? (
                    <span>
                      {theme.projectCount}{" "}
                      {theme.projectCount === 1 ? "project" : "projects"}
                    </span>
                  ) : null}
                  {theme.publicationCount > 0 ? (
                    <span>
                      {theme.publicationCount}{" "}
                      {theme.publicationCount === 1
                        ? "publication"
                        : "publications"}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState>Research themes are being prepared.</EmptyState>
        )}
      </section>
    </div>
  );
}
