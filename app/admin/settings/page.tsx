import type { Metadata } from "next";

import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import { requireCapability } from "@/lib/authz";
import { getSiteSettings } from "@/lib/site-settings";
import {
  contactTopics,
  MAX_BANNER_LENGTH,
  MAX_RETENTION_MONTHS,
  socialPlatforms,
} from "@/lib/site-settings-schema";

import { updateSettingsAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  await requireCapability("settings:manage", "/admin/settings");
  const settings = await getSiteSettings();

  return (
    <>
      <header className={styles.header}>
        <h1>Settings</h1>
        <p>Contact routes, public links, what the site shows, and notices.</p>
      </header>

      <ActionForm action={updateSettingsAction}>
        <fieldset className={styles.fieldset}>
          <legend>Contact addresses</legend>
          <div className={styles.fieldRow}>
            {contactTopics.map(({ key, label }) => (
              <div className={styles.field} key={key}>
                <label htmlFor={`contact-${key}`}>{label}</label>
                <input
                  id={`contact-${key}`}
                  name={`contact.${key}`}
                  type="email"
                  defaultValue={settings.contact[key]}
                  required
                />
              </div>
            ))}
          </div>
          <div className={styles.field}>
            <label htmlFor="location">Location</label>
            <input
              id="location"
              name="location"
              defaultValue={settings.location ?? ""}
              aria-describedby="location-hint"
            />
            <p id="location-hint" className={styles.hint}>
              Optional. Shown on the contact page when set.
            </p>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Social links</legend>
          <p className={styles.hint}>
            Optional https:// addresses, listed in the footer.
          </p>
          <div className={styles.fieldRow}>
            {socialPlatforms.map(({ key, label }) => (
              <div className={styles.field} key={key}>
                <label htmlFor={`social-${key}`}>{label}</label>
                <input
                  id={`social-${key}`}
                  name={`social.${key}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  defaultValue={settings.social[key] ?? ""}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Public sections</legend>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="showEvents"
              defaultChecked={settings.features.showEvents}
            />
            <span>Show Events</span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="showPartners"
              defaultChecked={settings.features.showPartners}
            />
            <span>Show Partners</span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="showNumbers"
              defaultChecked={settings.features.showNumbers}
            />
            <span>
              Show the numbers section on the home page once there are enough
              public records
            </span>
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Applications</legend>
          <div className={styles.field}>
            <label htmlFor="retentionMonths">
              Keep applications for (months)
            </label>
            <input
              id="retentionMonths"
              name="retentionMonths"
              type="number"
              min={1}
              max={MAX_RETENTION_MONTHS}
              step={1}
              defaultValue={settings.retentionMonths}
              required
            />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Site notice</legend>
          <div className={styles.field}>
            <label htmlFor="maintenanceBanner">Notice text</label>
            <textarea
              id="maintenanceBanner"
              name="maintenanceBanner"
              rows={3}
              maxLength={MAX_BANNER_LENGTH}
              defaultValue={settings.maintenanceBanner ?? ""}
              aria-describedby="banner-hint"
            />
            <p id="banner-hint" className={styles.hint}>
              Shown above every page while filled in. Leave empty to hide it.
            </p>
          </div>
        </fieldset>

        <SubmitButton pending="Saving…">Save settings</SubmitButton>
      </ActionForm>
    </>
  );
}
