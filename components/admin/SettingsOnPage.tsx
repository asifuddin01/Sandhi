import "server-only";

import { updateSettingsAction } from "@/app/admin/settings/actions";
import {
  ContactFields,
  NoticeFields,
  SectionsFields,
} from "@/app/admin/settings/SettingsFields";
import { getViewer } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { getSiteSettings } from "@/lib/site-settings";
import type { SettingsGroup } from "@/lib/site-settings-schema";

import { ActionForm, SubmitButton } from "./AdminForms";
import { OnPageBar } from "./OnPageBar";

/**
 * The settings a public page shows, changed on that page: contact details on
 * Contact, the notice and the section switches on the home page. The form
 * names its group, so the action stores that group alone. Drawn only for
 * someone who may manage settings; the action checks again.
 */
export async function SettingsOnPage({ group }: { group: SettingsGroup }) {
  const viewer = await getViewer();
  if (!viewer || !can(viewer.role, "settings:manage")) return null;
  const settings = await getSiteSettings();

  return (
    <OnPageBar
      actions={[
        {
          label:
            group === "contact"
              ? "Edit contact details"
              : "Site notice and sections",
          editor: (
            <ActionForm action={updateSettingsAction}>
              <input type="hidden" name="group" value={group} />
              {group === "contact" ? (
                <ContactFields settings={settings} />
              ) : (
                <>
                  <NoticeFields settings={settings} />
                  <SectionsFields settings={settings} />
                </>
              )}
              <SubmitButton pending="Saving…">Save</SubmitButton>
            </ActionForm>
          ),
          adding: false,
          own: "",
        },
      ]}
    />
  );
}
