import "server-only";

import { InviteForm, ShownToggle } from "@/app/admin/members/MemberForms";
import { canSetPublic, getMembersIndex } from "@/lib/admin/members";
import { getViewer } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";
import { can } from "@/lib/permissions";

import styles from "./Admin.module.css";
import { OnPageBar } from "./OnPageBar";

/**
 * Administration on the People page: inviting someone, and choosing who the
 * page shows. Drawn only for someone who may manage members; the actions
 * check the same capability again.
 */
export async function PeopleOnPage() {
  const viewer = await getViewer();
  if (
    !viewer ||
    !can(viewer.role, "members:manage") ||
    !isDatabaseConfigured()
  ) {
    return null;
  }
  const { members } = await getMembersIndex({});
  const choosable = members.filter((member) => canSetPublic(viewer, member));

  return (
    <OnPageBar
      actions={[
        {
          label: "Invite someone",
          editor: <InviteForm />,
          adding: false,
          own: "",
        },
        {
          label: "Choose who is shown",
          editor: (
            <ul className={styles.rows}>
              {choosable.map((member) => (
                <li key={member.id}>
                  <span>
                    {member.name} · {member.isPublic ? "Shown" : "Hidden"}
                  </span>
                  <ShownToggle member={member} />
                </li>
              ))}
            </ul>
          ),
          adding: false,
          own: "",
        },
      ]}
    />
  );
}
