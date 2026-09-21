import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { getMemberPublications } from "@/lib/portal/publications";
import {
  publicationStageLabels,
  publicationTypeLabels,
  type PublicationStageValue,
} from "@/lib/publications";
import type { PublicationType } from "@/lib/bibtex";

export const metadata: Metadata = { title: "Your publications" };

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export default async function PortalPublicationsPage() {
  const viewer = await requireViewer("/portal/publications");
  const publications = await getMemberPublications(viewer);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal">Portal</Link>
        </p>
        <h1>Your publications</h1>
        <p className={styles.lead}>
          Every paper you are an author on. Record one as a draft, then send it
          for internal review when it is ready to be read.
        </p>
        <div className={styles.actions}>
          <Link
            className="button button-primary"
            href="/portal/publications/new"
          >
            Record a publication
          </Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="yours">
        <h2 id="yours">Yours</h2>
        {publications.length === 0 ? (
          <p className={styles.hint}>
            Nothing yet. Recording a paper here puts it in front of the
            reviewers and, once it is published, on the public site with you
            credited.
          </p>
        ) : (
          <ul className={styles.cardList}>
            {publications.map((publication) => (
              <li className={styles.card} key={publication.id}>
                <h3>
                  <Link href={`/portal/publications/${publication.id}`}>
                    {publication.title}
                  </Link>
                </h3>
                <p className={styles.cardMeta}>
                  {publicationStageLabels[
                    publication.stage as PublicationStageValue
                  ] ?? publication.stage}
                  {" · "}
                  {publicationTypeLabels[publication.type as PublicationType] ??
                    publication.type}
                  {publication.venueName ? ` · ${publication.venueName}` : ""}
                  {publication.year ? ` · ${publication.year}` : ""}
                </p>
                <p className={styles.hint}>
                  {publication.editable
                    ? "Yours to change."
                    : "With the lab now — ask a reviewer for a change."}
                  {" · Last touched "}
                  <time dateTime={publication.updatedAt.toISOString()}>
                    {when.format(publication.updatedAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
