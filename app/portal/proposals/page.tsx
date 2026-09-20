import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { Prose } from "@/components/Prose";
import { getPostedProposals } from "@/lib/admin/proposals";
import { requireViewer } from "@/lib/authz";
import { workspaceMemberId } from "@/lib/portal-content";
import { PROPOSAL_STATUS_LABELS } from "@/lib/proposals";

import { InterestForm } from "./InterestForm";

export const metadata: Metadata = { title: "Proposals" };

function when(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export default async function PortalProposalsPage() {
  const viewer = await requireViewer("/portal/proposals");
  const memberId = workspaceMemberId(viewer);
  const proposals = await getPostedProposals();

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Proposals</h1>
        <p className={styles.lead}>
          Research the lab has decided is worth doing, waiting for the people to
          do it. Say you would work on one and an administrator will see you
          when the team is formed.
        </p>
      </header>

      {proposals.length === 0 ? (
        <p>
          Nothing queued right now. Anyone can send one in through{" "}
          <Link href="/proposals">Propose research</Link>.
        </p>
      ) : (
        <ul className={styles.cardList}>
          {proposals.map((proposal) => {
            const mine = proposal.interests.find(
              (interest) => interest.memberId === memberId,
            );
            return (
              <li className={styles.card} key={proposal.id}>
                <h2>{proposal.title}</h2>
                <p className={styles.cardMeta}>
                  {PROPOSAL_STATUS_LABELS[
                    proposal.status as keyof typeof PROPOSAL_STATUS_LABELS
                  ] ?? proposal.status}{" "}
                  · {proposal.proposerName}
                  {proposal.area ? ` · ${proposal.area.name}` : ""} ·{" "}
                  <time dateTime={proposal.createdAt.toISOString()}>
                    {when(proposal.createdAt)}
                  </time>
                </p>
                <Prose>{proposal.summary}</Prose>

                {proposal.interests.length > 0 ? (
                  <p className={styles.cardMeta}>
                    In so far:{" "}
                    {proposal.interests
                      .map((interest) => interest.member.name)
                      .join(", ")}
                  </p>
                ) : (
                  <p className={styles.cardMeta}>Nobody yet. Be first.</p>
                )}

                {proposal.project ? (
                  <p className={styles.cardMeta}>
                    Running as{" "}
                    <Link href={`/portal/projects/${proposal.project.slug}`}>
                      a project
                    </Link>
                    .
                  </p>
                ) : (
                  <InterestForm
                    proposalId={proposal.id}
                    interested={Boolean(mine)}
                    note={mine?.note ?? null}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
