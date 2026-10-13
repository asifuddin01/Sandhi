import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import { memberRanks, rankLabels, roleLabels } from "@/lib/admin/members";

import { inviteMemberAction, setMemberPublicAction } from "./actions";

/** Shared by the members page and the People page's administration bar. */
export function InviteForm() {
  return (
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
  );
}

export function ShownToggle({
  member,
}: {
  member: { id: string; name: string; isPublic: boolean };
}) {
  return (
    <ActionForm action={setMemberPublicAction}>
      <input type="hidden" name="memberId" value={member.id} />
      <SubmitButton
        tone="quiet"
        name="isPublic"
        value={member.isPublic ? "no" : "yes"}
        pending="Saving…"
        label={
          member.isPublic
            ? `Hide ${member.name} from People`
            : `Show ${member.name} on People`
        }
      >
        {member.isPublic ? "Hide" : "Show"}
      </SubmitButton>
    </ActionForm>
  );
}
