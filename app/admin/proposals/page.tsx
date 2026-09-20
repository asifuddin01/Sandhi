import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { formatAdminTime } from "@/components/admin/ContentIndex";
import { getProposalsIndex } from "@/lib/admin/proposals";
import { requireCapability } from "@/lib/authz";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUSES } from "@/lib/proposals";

export const metadata: Metadata = { title: "Proposals" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ProposalsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("proposals:review", "/admin/proposals");
  const params = await searchParams;
  const status = single(params.status);
  const query = single(params.q);
  const { proposals, total, page, pages, counts } = await getProposalsIndex({
    status,
    query,
    page: Number(single(params.page)) || 1,
  });

  const link = (target: { status?: string; page?: number }) => {
    const next = new URLSearchParams();
    const wanted = target.status ?? status;
    if (wanted) next.set("status", wanted);
    if (query) next.set("q", query);
    if (target.page && target.page > 1) next.set("page", String(target.page));
    const text = next.toString();
    return text ? `/admin/proposals?${text}` : "/admin/proposals";
  };

  return (
    <>
      <header className={styles.header}>
        <h1>Proposals</h1>
        <p>
          Research ideas sent in from anywhere. Take one to read it, queue the
          ones worth doing so the lab can say who is in, and send back the rest
          with a reason.
        </p>
      </header>

      <nav className={styles.filters} aria-label="Filter by state">
        <Link
          aria-current={status ? undefined : "page"}
          href={link({ status: "" })}
        >
          All ({total})
        </Link>
        {PROPOSAL_STATUSES.map((value) => (
          <Link
            aria-current={status === value ? "page" : undefined}
            href={link({ status: value })}
            key={value}
          >
            {PROPOSAL_STATUS_LABELS[value]} ({counts[value] ?? 0})
          </Link>
        ))}
      </nav>

      {proposals.length === 0 ? (
        <p className={styles.empty}>Nothing here yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">
              Research proposals, newest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Proposal</th>
                <th scope="col">State</th>
                <th scope="col">Interested</th>
                <th scope="col">Sent</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id}>
                  <td>
                    <Link href={`/admin/proposals/${proposal.id}`}>
                      {proposal.title}
                    </Link>
                    <span className={styles.rowSub}>
                      {proposal.proposerName}
                      {proposal.area ? ` · ${proposal.area.name}` : ""}
                      {proposal.reviewer
                        ? ` · with ${proposal.reviewer.name}`
                        : ""}
                    </span>
                  </td>
                  <td>
                    {PROPOSAL_STATUS_LABELS[
                      proposal.status as keyof typeof PROPOSAL_STATUS_LABELS
                    ] ?? proposal.status}
                  </td>
                  <td>{proposal.interested}</td>
                  <td>
                    <time dateTime={proposal.createdAt.toISOString()}>
                      {formatAdminTime(proposal.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className={styles.filters}>
          {page > 1 ? (
            <Link href={link({ page: page - 1 })}>Previous</Link>
          ) : null}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={link({ page: page + 1 })}>Next</Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
