import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import {
  getMembersIndex,
  memberRanks,
  memberStatuses,
  rankLabels,
  roleLabels,
  statusLabels,
  type MemberStatusValue,
} from "@/lib/admin/members";
import { requireCapability } from "@/lib/authz";
import { parseSystemRole } from "@/lib/permissions";

import { inviteMemberAction, manageInvitationAction } from "./actions";

export const metadata: Metadata = {
  title: "Members",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[] }>;
}) {
  const viewer = await requireCapability("members:manage", "/admin/members");
  const params = await searchParams;
  const query = single(params.q) ?? "";
  const statusParam = single(params.status);
  const status = memberStatuses.includes(statusParam as MemberStatusValue)
    ? (statusParam as MemberStatusValue)
    : undefined;
  const { members, invitations } = await getMembersIndex({ query, status });
  const now = new Date();

  return (
    <>
      <header className={styles.header}>
        <h1>Members</h1>
        <p>
          Invite people, set their access, and keep the record of who belongs.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite someone</h2>
        <ActionForm action={inviteMemberAction} resetOnSuccess>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="invite-email">Email</label>
              <input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="off"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="invite-role">Role</label>
              <select id="invite-role" name="role" defaultValue="MEMBER">
                <option value="MEMBER">{roleLabels.MEMBER}</option>
                <option value="REVIEWER">{roleLabels.REVIEWER}</option>
                <option value="ADMIN">{roleLabels.ADMIN}</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="invite-rank">Rank</label>
              <select id="invite-rank" name="rank" defaultValue="RESEARCHER">
                {memberRanks.map((rank) => (
                  <option key={rank} value={rank}>
                    {rankLabels[rank]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className={styles.hint}>
            The invitation link works for seven days and only for this address.
          </p>
          <SubmitButton pending="Sending…">Send invitation</SubmitButton>
        </ActionForm>
      </section>

      <section className={styles.section} aria-labelledby="pending-heading">
        <h2 id="pending-heading">Open invitations</h2>
        {/* Always mounted, so the outcome stays visible when the list empties. */}
        <ActionForm action={manageInvitationAction}>
          {invitations.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Access</th>
                    <th scope="col">Expires</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td>{invitation.email}</td>
                      <td>
                        {roleLabels[invitation.role]} ·{" "}
                        {rankLabels[invitation.rank]}
                      </td>
                      <td>
                        {invitation.expiresAt < now
                          ? "Expired"
                          : dateFormat.format(invitation.expiresAt)}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <SubmitButton
                            tone="quiet"
                            name="operation"
                            value={`resend:${invitation.id}`}
                            pending="Sending…"
                          >
                            Resend
                            <span className="visually-hidden">
                              {" "}
                              to {invitation.email}
                            </span>
                          </SubmitButton>
                          <SubmitButton
                            tone="danger"
                            name="operation"
                            value={`withdraw:${invitation.id}`}
                            pending="Withdrawing…"
                          >
                            Withdraw
                            <span className="visually-hidden">
                              {" "}
                              invitation for {invitation.email}
                            </span>
                          </SubmitButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>No invitations are waiting.</p>
          )}
        </ActionForm>
      </section>

      <section className={styles.section} aria-labelledby="members-heading">
        <h2 id="members-heading">People</h2>
        <form className={styles.filters} method="get" role="search">
          <div className={styles.field}>
            <label htmlFor="member-query">Name or email</label>
            <input
              id="member-query"
              name="q"
              type="search"
              defaultValue={query}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="member-status">Status</label>
            <select
              id="member-status"
              name="status"
              defaultValue={status ?? ""}
            >
              <option value="">Any status</option>
              {memberStatuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <button className={styles.quietButton} type="submit">
            Filter
          </button>
        </form>

        {members.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Access</th>
                  <th scope="col">Status</th>
                  <th scope="col">Public profile</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link href={`/admin/members/${member.id}`}>
                        {member.name}
                      </Link>
                      {member.user ? (
                        <span className={styles.secondary}>
                          {member.user.email}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {member.user
                        ? roleLabels[parseSystemRole(member.user.role)]
                        : "No account"}{" "}
                      · {rankLabels[member.rank]}
                    </td>
                    <td>{statusLabels[member.status]}</td>
                    <td>{member.isPublic ? "Shown" : "Hidden"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>No members match.</p>
        )}
      </section>

      <p className={styles.hint}>
        Signed in as {viewer.email}. Only the Owner can change the Owner.
      </p>
    </>
  );
}
