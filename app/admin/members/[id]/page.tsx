import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import {
  ActionForm,
  ConfirmByNameDialog,
  SubmitButton,
} from "@/components/admin/AdminForms";
import {
  getMemberDetail,
  memberRanks,
  rankLabels,
  roleLabels,
  scholarlyRecordSize,
  statusLabels,
} from "@/lib/admin/members";
import { requireCapability } from "@/lib/authz";
import { can, canManageMember, parseSystemRole } from "@/lib/permissions";

import {
  removeMemberAction,
  resetMemberTwoFactorAction,
  setMemberStatusAction,
  transferOwnershipAction,
  updateMemberAccessAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Member",
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireCapability(
    "members:manage",
    `/admin/members/${id}`,
  );
  const detail = await getMemberDetail(id);
  if (!detail) notFound();

  const { member, history } = detail;
  const role = member.user ? parseSystemRole(member.user.role) : "MEMBER";
  const isSelf = member.user?.id === viewer.userId;
  const manageable = !isSelf && canManageMember(viewer.role, role);
  const record = scholarlyRecordSize(member._count);
  const canTransfer =
    can(viewer.role, "ownership:transfer") &&
    !isSelf &&
    member.user !== null &&
    member.status === "ACTIVE";

  return (
    <>
      <p className={styles.breadcrumb}>
        <Link href="/admin/members">Members</Link>
      </p>
      <header className={styles.header}>
        <h1>{member.name}</h1>
        <p>
          {member.user?.email ?? "No account yet"} ·{" "}
          {member.user ? roleLabels[role] : "No role"} ·{" "}
          {statusLabels[member.status]}
        </p>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Credited work</dt>
          <dd>
            {member._count.authorships} publications, {member._count.projects}{" "}
            projects, {member._count.insights} research notes,{" "}
            {member._count.experiments} experiments
          </dd>
        </div>
        <div>
          <dt>Public profile</dt>
          <dd>
            {member.isPublic ? (
              <Link href={`/people/${member.slug}`}>Shown on People</Link>
            ) : (
              "Hidden"
            )}
          </dd>
        </div>
      </dl>

      {isSelf ? (
        <p className={styles.notice}>
          This is your own account. Another administrator must change your
          access or status.
        </p>
      ) : !manageable ? (
        <p className={styles.notice}>Only the Owner can change the Owner.</p>
      ) : (
        <>
          <section className={styles.section} aria-labelledby="access-heading">
            <h2 id="access-heading">Access</h2>
            <ActionForm action={updateMemberAccessAction}>
              <input type="hidden" name="memberId" value={member.id} />
              <div className={styles.fieldRow}>
                {member.user && role !== "OWNER" ? (
                  <div className={styles.field}>
                    <label htmlFor="member-role">Role</label>
                    <select id="member-role" name="role" defaultValue={role}>
                      <option value="MEMBER">{roleLabels.MEMBER}</option>
                      <option value="REVIEWER">{roleLabels.REVIEWER}</option>
                      <option value="ADMIN">{roleLabels.ADMIN}</option>
                    </select>
                  </div>
                ) : null}
                <div className={styles.field}>
                  <label htmlFor="member-rank">Rank</label>
                  <select
                    id="member-rank"
                    name="rank"
                    defaultValue={member.rank}
                  >
                    {memberRanks.map((rank) => (
                      <option key={rank} value={rank}>
                        {rankLabels[rank]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <SubmitButton pending="Saving…">Save access</SubmitButton>
            </ActionForm>
          </section>

          {role !== "OWNER" ? (
            <section
              className={styles.section}
              aria-labelledby="status-heading"
            >
              <h2 id="status-heading">Status</h2>
              {/* One form, so its message survives the buttons changing. */}
              <ActionForm action={setMemberStatusAction}>
                <input type="hidden" name="memberId" value={member.id} />
                <div className={styles.rowActions}>
                  {member.status !== "ACTIVE" ? (
                    <SubmitButton
                      tone="quiet"
                      name="status"
                      value="ACTIVE"
                      pending="Saving…"
                    >
                      Make active
                    </SubmitButton>
                  ) : null}
                  {member.status !== "ALUMNI" ? (
                    <SubmitButton
                      tone="quiet"
                      name="status"
                      value="ALUMNI"
                      pending="Saving…"
                    >
                      Mark as alumni
                    </SubmitButton>
                  ) : null}
                  {member.status !== "SUSPENDED" ? (
                    <SubmitButton
                      tone="danger"
                      name="status"
                      value="SUSPENDED"
                      pending="Suspending…"
                    >
                      Suspend and sign out
                    </SubmitButton>
                  ) : null}
                </div>
              </ActionForm>
            </section>
          ) : null}

          {member.user ? (
            <section
              className={styles.section}
              aria-labelledby="two-factor-heading"
            >
              <h2 id="two-factor-heading">Two-factor authentication</h2>
              {member.user.twoFactorEnabled ? (
                <>
                  <p className={styles.empty}>
                    On. If {member.name} has lost their phone and backup codes,
                    reset it: they are signed out everywhere and set it up
                    again.
                  </p>
                  <ConfirmByNameDialog
                    action={resetMemberTwoFactorAction}
                    name={member.name}
                    hidden={{ memberId: member.id }}
                    trigger={`Reset two-factor authentication for ${member.name}`}
                    title={`Reset two-factor authentication for ${member.name}?`}
                    description="Their authenticator and backup codes stop working, and every session they have ends. They are emailed about it."
                    confirmLabel="Reset two-factor authentication"
                  />
                </>
              ) : (
                <p className={styles.empty}>
                  Off.{" "}
                  {role === "MEMBER"
                    ? "Members can turn it on from Account security."
                    : "Their role requires it, so they set it up before administration opens."}
                </p>
              )}
            </section>
          ) : null}

          {role !== "OWNER" ? (
            <section
              className={styles.section}
              aria-labelledby="remove-heading"
            >
              <h2 id="remove-heading">Remove</h2>
              {record > 0 ? (
                <p className={styles.empty}>
                  {member.name} is credited on lab work, so the record stays.
                  Mark them as alumni instead.
                </p>
              ) : (
                <ConfirmByNameDialog
                  action={removeMemberAction}
                  name={member.name}
                  hidden={{ memberId: member.id }}
                  trigger={`Remove ${member.name}`}
                  title={`Remove ${member.name}?`}
                  description="This deletes their account and member record. It cannot be undone."
                  confirmLabel="Remove member"
                />
              )}
            </section>
          ) : null}
        </>
      )}

      {canTransfer ? (
        <section className={styles.section} aria-labelledby="transfer-heading">
          <h2 id="transfer-heading">Ownership</h2>
          <ConfirmByNameDialog
            action={transferOwnershipAction}
            name={member.name}
            hidden={{ memberId: member.id }}
            trigger={`Transfer ownership to ${member.name}`}
            title={`Transfer ownership to ${member.name}?`}
            description="They become the Owner and you become an administrator. Only they can transfer it back."
            confirmLabel="Transfer ownership"
          />
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="history-heading">
        <h2 id="history-heading">History</h2>
        {history.length > 0 ? (
          <ul className={styles.rows}>
            {history.map((entry) => (
              <li key={entry.id}>
                <span>
                  {entry.action} by {entry.actor?.name ?? "System"}
                </span>
                <span>
                  <time dateTime={entry.createdAt.toISOString()}>
                    {timeFormat.format(entry.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No recorded changes yet.</p>
        )}
      </section>
    </>
  );
}
