import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import { Prose } from "@/components/Prose";
import { getProposal } from "@/lib/admin/proposals";
import { requireCapability } from "@/lib/authz";
import { can } from "@/lib/permissions";
import {
  canApprove,
  canMove,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_MEANING,
  tellsProposer,
  type ProposalStatusValue,
} from "@/lib/proposals";

import { ApproveProposal, ReviewMoves, TellProposerAgain } from "./ReviewForms";

export const metadata: Metadata = { title: "Proposal" };

const MOVES = [
  { move: "take", label: "Take it to read", pending: "Taking…" },
  { move: "queue", label: "Queue it for the lab", pending: "Queueing…" },
  { move: "decline", label: "Send it back", pending: "Sending…" },
] as const;

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireCapability(
    "proposals:review",
    `/admin/proposals/${id}`,
  );
  const proposal = await getProposal(id);
  if (!proposal) notFound();

  const status = proposal.status as ProposalStatusValue;
  const moves = MOVES.filter((entry) => canMove(status, entry.move));
  const mayApprove =
    can(viewer.role, "proposals:approve") &&
    canApprove(status) &&
    !proposal.project;

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/admin/proposals">Proposals</Link>
      </nav>
      <header className={styles.header}>
        <h1>{proposal.title}</h1>
        <p>
          {PROPOSAL_STATUS_LABELS[status]} · {PROPOSAL_STATUS_MEANING[status]}
        </p>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>From</dt>
          <dd>
            {proposal.proposer ? (
              <Link href={`/people/${proposal.proposer.slug}`}>
                {proposal.proposerName}
              </Link>
            ) : (
              proposal.proposerName
            )}
            {proposal.proposerAffiliation
              ? `, ${proposal.proposerAffiliation}`
              : ""}
            <br />
            <a href={`mailto:${proposal.proposerEmail}`}>
              {proposal.proposerEmail}
            </a>
          </dd>
        </div>
        <div>
          <dt>Sent</dt>
          <dd>
            <time dateTime={proposal.createdAt.toISOString()}>
              {formatAdminTime(proposal.createdAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Research area</dt>
          <dd>{proposal.area ? proposal.area.name : "Not said"}</dd>
        </div>
        <div>
          <dt>With</dt>
          <dd>{proposal.reviewer?.name ?? "Nobody yet"}</dd>
        </div>
        {proposal.project ? (
          <div>
            <dt>Became</dt>
            <dd>
              <Link href={`/projects/${proposal.project.slug}`}>
                {proposal.project.title}
              </Link>
            </dd>
          </div>
        ) : null}
        {proposal.decidedBy ? (
          <div>
            <dt>Decided by</dt>
            <dd>
              {proposal.decidedBy.name}
              {proposal.decidedAt ? (
                <>
                  ,{" "}
                  <time dateTime={proposal.decidedAt.toISOString()}>
                    {formatAdminTime(proposal.decidedAt)}
                  </time>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      <section className={styles.section} aria-labelledby="proposal-summary">
        <h2 id="proposal-summary">In a paragraph</h2>
        <Prose>{proposal.summary}</Prose>
      </section>

      <section className={styles.section} aria-labelledby="proposal-question">
        <h2 id="proposal-question">What it would ask</h2>
        <Prose>{proposal.question}</Prose>
      </section>

      {proposal.approach ? (
        <section className={styles.section} aria-labelledby="proposal-approach">
          <h2 id="proposal-approach">How</h2>
          <Prose>{proposal.approach}</Prose>
        </section>
      ) : null}

      {proposal.outcome ? (
        <section className={styles.section} aria-labelledby="proposal-outcome">
          <h2 id="proposal-outcome">What would come of it</h2>
          <Prose>{proposal.outcome}</Prose>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="proposal-interest">
        <h2 id="proposal-interest">Who is in</h2>
        {proposal.interests.length === 0 ? (
          <p className={styles.empty}>
            Nobody yet. A queued proposal appears in the portal, where members
            say whether they would work on it.
          </p>
        ) : (
          <ul className={styles.rows}>
            {proposal.interests.map((interest) => (
              <li key={interest.member.id}>
                <span>
                  <Link href={`/people/${interest.member.slug}`}>
                    {interest.member.name}
                  </Link>
                  {interest.note ? (
                    <span className={styles.rowSub}>{interest.note}</span>
                  ) : null}
                </span>
                <span>
                  <time dateTime={interest.createdAt.toISOString()}>
                    {formatAdminTime(interest.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {proposal.decisionNote ? (
        <section className={styles.section} aria-labelledby="proposal-note">
          <h2 id="proposal-note">On the record</h2>
          <Prose>{proposal.decisionNote}</Prose>
        </section>
      ) : null}

      {tellsProposer(status) ? (
        <section className={styles.section} aria-labelledby="proposal-told">
          <h2 id="proposal-told">The proposer</h2>
          {proposal.decisionSentAt ? (
            <p className={styles.hint}>
              {proposal.proposerName} was told on{" "}
              <time dateTime={proposal.decisionSentAt.toISOString()}>
                {formatAdminTime(proposal.decisionSentAt)}
              </time>
              .
            </p>
          ) : (
            <TellProposerAgain id={proposal.id} name={proposal.proposerName} />
          )}
        </section>
      ) : null}

      {moves.length > 0 ? (
        <section className={styles.section} aria-labelledby="proposal-review">
          <h2 id="proposal-review">Review</h2>
          <ReviewMoves id={proposal.id} moves={[...moves]} />
        </section>
      ) : null}

      {mayApprove ? (
        <section className={styles.section} aria-labelledby="proposal-approve">
          <h2 id="proposal-approve">Approve</h2>
          <ApproveProposal
            id={proposal.id}
            interested={proposal.interests.map((interest) => ({
              id: interest.member.id,
              name: interest.member.name,
            }))}
          />
        </section>
      ) : null}
    </>
  );
}
