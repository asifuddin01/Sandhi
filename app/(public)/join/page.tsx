import type { Metadata } from "next";

import { updateIntakeAction } from "@/app/admin/settings/actions";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForms";
import { JoinForm } from "@/components/forms/JoinForm";
import admin from "@/components/public/ResearchPages.module.css";
import { getViewer } from "@/lib/authz";
import { joinInterestTypes } from "@/lib/forms";
import { resolveOpenOpportunity } from "@/lib/forms-opportunity";
import { intakeStatus, intakeTypes } from "@/lib/intake";
import { can } from "@/lib/permissions";
import { getSiteSettings } from "@/lib/site-settings";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Join SANDHI",
  description:
    "Introduce yourself to SANDHI Research Lab as a researcher, intern, or collaborator.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string | string[] }>;
}) {
  const query = await searchParams;
  const requested = Array.isArray(query.opportunity)
    ? query.opportunity[0]
    : query.opportunity;
  const validSlug =
    requested && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requested)
      ? requested
      : undefined;
  const [found, settings, viewer] = await Promise.all([
    validSlug ? resolveOpenOpportunity(validSlug) : null,
    getSiteSettings(),
    getViewer(),
  ]);
  // Drawn only for someone who may change it; the action checks again.
  const manages = Boolean(viewer && can(viewer.role, "settings:manage"));
  const opportunity = found
    ? { slug: found.slug, title: found.title, type: found.type }
    : null;
  const intake = intakeStatus(settings.intake, new Date());
  // A published opening is its own invitation, whatever the general switch says.
  if (opportunity) delete intake[opportunity.type];

  return (
    <div className={styles.page}>
      <header className={`page-shell ${styles.header}`}>
        <h1>Begin at the junction.</h1>
        <p className={styles.lead}>
          Tell us what you hope to explore, what you bring, and where our work
          might meet.
        </p>
      </header>
      {manages ? (
        <aside
          className={`page-shell ${styles.intake}`}
          aria-label="Manage applications"
        >
          <div className={admin.adminBar}>
            <p className={admin.adminBarTitle}>Administration</p>
            <ActionForm
              action={updateIntakeAction}
              className={styles.intakeForm}
            >
              {intakeTypes.map((type) => (
                <div className={admin.adminRow} key={type}>
                  <label className={admin.adminCheck}>
                    <input
                      type="checkbox"
                      name={`${type}.open`}
                      defaultChecked={settings.intake[type].open}
                    />
                    Take applications:{" "}
                    {
                      joinInterestTypes.find(({ value }) => value === type)
                        ?.label
                    }
                  </label>
                  <label htmlFor={`${type}-deadline`}>Closing day</label>
                  <input
                    id={`${type}-deadline`}
                    name={`${type}.deadline`}
                    type="date"
                    defaultValue={settings.intake[type].deadline ?? ""}
                  />
                </div>
              ))}
              <p className={styles.intakeHint}>
                Untick a kind to close it. A closing day is optional: it is
                shown on the form, and the form closes by itself when that day
                ends in Dhaka. Project proposals and academic and industry
                collaborations are always open.
              </p>
              <SubmitButton tone="quiet" pending="Saving…">
                Save
              </SubmitButton>
            </ActionForm>
          </div>
        </aside>
      ) : null}
      <section
        className={`page-shell ${styles.formSection}`}
        aria-label="Application form"
      >
        <JoinForm
          siteKey={process.env.TURNSTILE_SITE_KEY}
          opportunity={opportunity ?? undefined}
          requestedOpportunity={validSlug}
          intake={intake}
        />
      </section>
    </div>
  );
}
