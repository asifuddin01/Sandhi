import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/public/EmptyState";
import styles from "@/components/public/OpportunityResourcePages.module.css";
import { PageIntro } from "@/components/public/PageIntro";
import {
  getPublicResources,
  RESOURCES_EMPTY,
  RESOURCE_KIND_LABELS,
  RESOURCE_KINDS,
} from "@/lib/public-resources";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Datasets, benchmarks, code, models, tools, tutorials, and technical reports from SANDHI Research Lab.",
  alternates: { canonical: "/resources" },
};

export default async function ResourcesPage() {
  const resources = await getPublicResources();

  return (
    <div className={styles.page}>
      <PageIntro
        title="Resources"
        lead="Research outputs built to be read, used, and reproduced."
      />

      {resources.length === 0 ? (
        <EmptyState>{RESOURCES_EMPTY}</EmptyState>
      ) : (
        RESOURCE_KINDS.map((kind) => {
          const group = resources.filter((resource) => resource.kind === kind);
          const headingId = `${kind.toLowerCase().replaceAll("_", "-")}-heading`;

          return (
            <section
              className={styles.group}
              aria-labelledby={headingId}
              key={kind}
            >
              <div className={styles.groupHeader}>
                <h2 id={headingId}>{RESOURCE_KIND_LABELS[kind]}</h2>
              </div>

              {group.length > 0 ? (
                <div className={styles.entryList}>
                  {group.map((resource) => (
                    <article className={styles.entry} key={resource.slug}>
                      <div>
                        <h3>
                          <Link href={`/resources/${resource.slug}`}>
                            {resource.name}
                          </Link>
                        </h3>
                        <p className={styles.entryDescription}>
                          {resource.description}
                        </p>
                      </div>
                      <div className={styles.entryMeta}>
                        {resource.version ? (
                          <p>Version {resource.version}</p>
                        ) : null}
                        {resource.license ? (
                          <p>License: {resource.license}</p>
                        ) : null}
                        {resource.areas.length > 0 ? (
                          <ul
                            className={styles.areaList}
                            aria-label="Research areas"
                          >
                            {resource.areas.map((area) => (
                              <li key={area.slug}>
                                <Link href={`/research/areas/${area.slug}`}>
                                  {area.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyCategory}>
                  <p>No public resources of this kind are available yet.</p>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
