import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import {
  authorableMembers,
  getMemberPublication,
  memberMaySubmit,
} from "@/lib/portal/publications";
import {
  publicationStageLabels,
  type PublicationStageValue,
} from "@/lib/publications";

import { PublicationForm } from "../PublicationForm";
import { SendForReview } from "./SendForReview";

export const metadata: Metadata = { title: "Your publication" };

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export default async function MemberPublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer(`/portal/publications/${id}`);
  const publication = await getMemberPublication(viewer, id);
  // A paper they are not on answers the same as one that does not exist.
  if (!publication) notFound();

  const members = publication.editable ? await authorableMembers() : [];

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal/publications">Your publications</Link>
        </p>
        <h1>{publication.title}</h1>
        <p className={styles.lead}>
          {publicationStageLabels[publication.stage as PublicationStageValue] ??
            publication.stage}
          {publication.state === "PUBLISHED"
            ? " · on the public site"
            : " · not public"}
        </p>
      </header>

      {publication.reviews.length > 0 ? (
        <section className={styles.section} aria-labelledby="reviews">
          <h2 id="reviews">What the reviewers said</h2>
          <ul className={styles.activity}>
            {publication.reviews.map((review) => (
              <li key={review.id}>
                <span>{review.comment}</span>
                <span className={styles.hint}>
                  {review.reviewer ?? "A reviewer"} · {review.decision} ·{" "}
                  <time dateTime={review.createdAt.toISOString()}>
                    {when.format(review.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {memberMaySubmit(publication.stage) ? (
        <section className={styles.section} aria-labelledby="send">
          <h2 id="send">Send it to be read</h2>
          <SendForReview id={publication.id} />
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="details">
        <h2 id="details">The paper</h2>
        {publication.editable ? (
          <PublicationForm
            members={members}
            values={{
              id: publication.id,
              title: publication.title,
              abstract: publication.abstract,
              type: publication.type,
              venueName: publication.venueName ?? "",
              venueShort: publication.venueShort ?? "",
              year: publication.year ? String(publication.year) : "",
              doi: publication.doi ?? "",
              arxivId: publication.arxivId ?? "",
              pdfUrl: publication.pdfUrl ?? "",
              codeUrl: publication.codeUrl ?? "",
              datasetUrl: publication.datasetUrl ?? "",
              pageUrl: publication.pageUrl ?? "",
              authors: publication.authors.map((author) => ({
                memberId: author.memberId,
                externalName: author.externalName,
                externalAffiliation: author.externalAffiliation,
                equalContribution: author.equalContribution,
                corresponding: author.corresponding,
              })),
            }}
          />
        ) : (
          <>
            <p className={styles.hint}>
              This is with the lab now, so it is read-only here. Ask a reviewer
              for a change.
            </p>
            <dl className={styles.facts}>
              <div>
                <dt>Authors</dt>
                <dd>
                  {publication.authors
                    .map(
                      (author) =>
                        author.memberName ?? author.externalName ?? "Unnamed",
                    )
                    .join(", ")}
                </dd>
              </div>
              {publication.venueName ? (
                <div>
                  <dt>Venue</dt>
                  <dd>{publication.venueName}</dd>
                </div>
              ) : null}
              {publication.year ? (
                <div>
                  <dt>Year</dt>
                  <dd>{publication.year}</dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
