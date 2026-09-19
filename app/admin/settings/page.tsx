import type { Metadata } from "next";

import styles from "@/components/admin/Admin.module.css";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import { requireCapability } from "@/lib/authz";
import {
  IOS_DISTRIBUTIONS,
  MAX_RELEASE_NOTES_LENGTH,
} from "@/lib/mobile-app";
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

        <fieldset className={styles.fieldset}>
          <legend>SANDHI app</legend>
          <p className={styles.hint}>
            What the public <code>/app</code> page offers and what the installed
            app checks on launch. Both platforms are optional; a platform is
            published only when it has both a version and an address. The page
            stays hidden until &ldquo;Publish the app page&rdquo; is ticked.
          </p>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="mobile.enabled"
              defaultChecked={settings.mobileApp.enabled}
            />
            <span>Publish the app page</span>
          </label>
          <div className={styles.field}>
            <label htmlFor="mobile-minimum">Minimum supported version</label>
            <input
              id="mobile-minimum"
              name="mobile.minimumVersion"
              placeholder="1.0.0"
              defaultValue={settings.mobileApp.minimumVersion ?? ""}
              aria-describedby="mobile-minimum-hint"
            />
            <p id="mobile-minimum-hint" className={styles.hint}>
              Installed apps older than this are asked to update before the API
              answers them. Leave empty to accept every version.
            </p>
          </div>

          <h3 className={styles.subheading}>Android</h3>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="android-version">Version</label>
              <input
                id="android-version"
                name="mobile.android.version"
                placeholder="1.0.0"
                defaultValue={settings.mobileApp.android?.version ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="android-code">Version code</label>
              <input
                id="android-code"
                name="mobile.android.versionCode"
                type="number"
                min={1}
                step={1}
                defaultValue={settings.mobileApp.android?.versionCode ?? ""}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="android-url">Signed APK address</label>
            <input
              id="android-url"
              name="mobile.android.downloadUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={settings.mobileApp.android?.downloadUrl ?? ""}
              aria-describedby="android-url-hint"
            />
            <p id="android-url-hint" className={styles.hint}>
              Where the file is served from. The site links to it through{" "}
              <code>/download/android</code>, so the shared link survives a
              release.
            </p>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="android-size">Size in bytes</label>
              <input
                id="android-size"
                name="mobile.android.sizeBytes"
                type="number"
                min={1}
                step={1}
                defaultValue={settings.mobileApp.android?.sizeBytes ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="android-min-os">Minimum Android version</label>
              <input
                id="android-min-os"
                name="mobile.android.minimumOsVersion"
                placeholder="10"
                defaultValue={
                  settings.mobileApp.android?.minimumOsVersion ?? ""
                }
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="android-sha">SHA-256 of the APK</label>
            <input
              id="android-sha"
              name="mobile.android.sha256"
              defaultValue={settings.mobileApp.android?.sha256 ?? ""}
              aria-describedby="android-sha-hint"
            />
            <p id="android-sha-hint" className={styles.hint}>
              64 hexadecimal characters, from{" "}
              <code>shasum -a 256 sandhi.apk</code>. Shown on the page so a
              member can check the download before installing it.
            </p>
          </div>
          <div className={styles.field}>
            <label htmlFor="android-notes">Release notes</label>
            <textarea
              id="android-notes"
              name="mobile.android.notes"
              rows={3}
              maxLength={MAX_RELEASE_NOTES_LENGTH}
              defaultValue={settings.mobileApp.android?.notes ?? ""}
            />
          </div>

          <h3 className={styles.subheading}>iOS</h3>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="ios-version">Version</label>
              <input
                id="ios-version"
                name="mobile.ios.version"
                placeholder="1.0.0"
                defaultValue={settings.mobileApp.ios?.version ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="ios-distribution">Distribution</label>
              <select
                id="ios-distribution"
                name="mobile.ios.distribution"
                defaultValue={
                  settings.mobileApp.ios?.distribution ?? "testflight"
                }
              >
                {IOS_DISTRIBUTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="ios-url">Install link</label>
            <input
              id="ios-url"
              name="mobile.ios.installUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={settings.mobileApp.ios?.installUrl ?? ""}
              aria-describedby="ios-url-hint"
            />
            <p id="ios-url-hint" className={styles.hint}>
              The TestFlight or private distribution address members open on the
              device they are installing on.
            </p>
          </div>
          <div className={styles.field}>
            <label htmlFor="ios-min-os">Minimum iOS version</label>
            <input
              id="ios-min-os"
              name="mobile.ios.minimumOsVersion"
              placeholder="16"
              defaultValue={settings.mobileApp.ios?.minimumOsVersion ?? ""}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="ios-notes">Release notes</label>
            <textarea
              id="ios-notes"
              name="mobile.ios.notes"
              rows={3}
              maxLength={MAX_RELEASE_NOTES_LENGTH}
              defaultValue={settings.mobileApp.ios?.notes ?? ""}
            />
          </div>
        </fieldset>

        <SubmitButton pending="Saving…">Save settings</SubmitButton>
      </ActionForm>
    </>
  );
}
