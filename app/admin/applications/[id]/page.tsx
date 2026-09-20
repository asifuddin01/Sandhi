import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import { getApplication, hasAccount } from "@/lib/admin/applications";
import {
  APPLICATION_STATUS_LABELS,
  canInvite,
  RATING_LABELS,
  typeLabel,
  type ApplicationStatusValue,
} from "@/lib/applications";
import { requireCapability } from "@/lib/authz";

import {
  InviteApplicant,
  NoteForm,
  RatingForm,
  StatusForm,
} from "./ReviewForms";

export const metadata: Metadata = { title: "Application" };

const LINKS = [
  ["websiteUrl", "Website"],
  ["scholarUrl", "Google Scholar"],
  ["githubUrl", "GitHub"],
  ["linkedinUrl", "LinkedIn"],
] as const;

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("applications:manage", `/admin/applications/${id}`);
  const application = await getApplication(id);
  if (!application) notFound();

  const status = application.status as ApplicationStatusValue;
  const mayInvite = canInvite(status);
  // Asked only when it changes what the page offers.
  const alreadyHasAccount = mayInvite
    ? await hasAccount(application.email)
    : false;

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/admin/applications">Applications</Link>
      </nav>
      <header className={styles.header}>
        <h1>{application.name}</h1>
        <p>
          {typeLabel(application.type)} ·{" "}
          {APPLICATION_STATUS_LABELS[status] ?? status}
        </p>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${application.email}`}>{application.email}</a>
          </dd>
        </div>
        {application.phone ? (
          <div>
            <dt>Phone</dt>
            <dd>{application.phone}</dd>
          </div>
        ) : null}
        <div>
          <dt>Now</dt>
          <dd>
            {application.currentRole}, {application.institution}
          </dd>
        </div>
        <div>
          <dt>Sent</dt>
          <dd>
            <time dateTime={application.createdAt.toISOString()}>
              {formatAdminTime(application.createdAt)}
            </time>
          </dd>
        </div>
        {application.opportunity ? (
          <div>
            <dt>Applying for</dt>
            <dd>
              <Link href={`/opportunities/${application.opportunity.slug}`}>
                {application.opportunity.title}
              </Link>
            </dd>
          </div>
        ) : null}
        {application.hoursPerWeek ? (
          <div>
            <dt>Hours a week</dt>
            <dd>{application.hoursPerWeek}</dd>
          </div>
        ) : null}
        {application.orcid ? (
          <div>
            <dt>ORCID</dt>
            <dd>{application.orcid}</dd>
          </div>
        ) : null}
        <div>
          <dt>Rating</dt>
          <dd>
            {application.rating === null
              ? "Not rated"
              : (RATING_LABELS[application.rating] ?? application.rating)}
          </dd>
        </div>
      </dl>

      {application.interests.length > 0 ? (
        <section className={styles.section} aria-labelledby="interests">
          <h2 id="interests">Research interests</h2>
          <p>{application.interests.join(" · ")}</p>
        </section>
      ) : null}

      {LINKS.some(([key]) => application[key]) ? (
        <section className={styles.section} aria-labelledby="links">
          <h2 id="links">Links</h2>
          <ul>
            {LINKS.filter(([key]) => application[key]).map(([key, label]) => (
              <li key={key}>
                {/* Somebody else's address, sent in by a stranger: opened in
                    its own context, and never told where the click came
                    from. */}
                <a
                  href={application[key] as string}
                  rel="noreferrer noopener nofollow"
                  target="_blank"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="files">
        <h2 id="files">Files</h2>
        {application.cvKey || application.proposalKey ? (
          <>
            <ul>
              {application.cvKey ? (
                <li>
                  <a href={`/files/applications/${application.id}/cv`}>
                    CV (PDF)
                  </a>
                </li>
              ) : null}
              {application.proposalKey ? (
                <li>
                  <a href={`/files/applications/${application.id}/proposal`}>
                    Proposal (PDF)
                  </a>
                </li>
              ) : null}
            </ul>
            <p className={styles.hint}>
              Links are signed for ten minutes and work only for people who read
              applications. They cannot be forwarded.
            </p>
          </>
        ) : (
          <p className={styles.hint}>Nothing was attached.</p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="motivation">
        <h2 id="motivation">Why they wrote</h2>
        <p className={styles.plainText}>{application.motivation}</p>
      </section>

      {application.experience ? (
        <section className={styles.section} aria-labelledby="experience">
          <h2 id="experience">Experience</h2>
          <p className={styles.plainText}>{application.experience}</p>
        </section>
      ) : null}

      {application.proposalTitle || application.proposalSummary ? (
        <section className={styles.section} aria-labelledby="proposal">
          <h2 id="proposal">Their proposal</h2>
          {application.proposalTitle ? (
            <p>
              <strong>{application.proposalTitle}</strong>
            </p>
          ) : null}
          {application.proposalSummary ? (
            <p className={styles.plainText}>{application.proposalSummary}</p>
          ) : null}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="decide">
        <h2 id="decide">Where this has got to</h2>
        <StatusForm id={application.id} status={status} />
        <RatingForm id={application.id} rating={application.rating} />
        {mayInvite && alreadyHasAccount ? (
          <p className={styles.hint}>
            {application.email} already has an account, so there is nobody to
            invite. Find them in Members.
          </p>
        ) : mayInvite || status === "INVITED" ? (
          <InviteApplicant
            id={application.id}
            invited={status === "INVITED"}
            name={application.name}
          />
        ) : (
          <p className={styles.hint}>
            Accepting this application offers an invitation here.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="notes">
        <h2 id="notes">Notes</h2>
        <NoteForm id={application.id} />
        {application.notes.length > 0 ? (
          <ul className={styles.noteList}>
            {application.notes.map((note) => (
              <li key={note.id}>
                <span>{note.body}</span>
                <span className={styles.hint}>
                  {note.author?.name ?? "A former member"} ·{" "}
                  <time dateTime={note.createdAt.toISOString()}>
                    {formatAdminTime(note.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>No notes yet.</p>
        )}
      </section>
    </>
  );
}
