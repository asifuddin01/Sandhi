import type { Metadata } from "next";

import { getLegalSettings } from "@/lib/public-content";

import styles from "../ContentPages.module.css";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How SANDHI Research Lab handles applications, account data, files, analytics, and deletion requests.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const { applicationRetentionMonths, contactEmail } = await getLegalSettings();

  return (
    <article className={styles.legalPage}>
      <header className={styles.pageHeader}>
        <h1>Privacy policy</h1>
        <p className={styles.lead}>
          A plain-language account of the information the lab collects and why.
        </p>
      </header>

      <p className={styles.reviewNotice} role="note">
        Draft for legal review. This policy must be reviewed before the site
        launches.
      </p>

      <div className={styles.legalBody}>
        <section aria-labelledby="privacy-scope">
          <h2 id="privacy-scope">What this policy covers</h2>
          <p>
            This policy covers information submitted through the SANDHI Research
            Lab website, information kept in member accounts, and basic website
            analytics. It does not cover external services linked from this
            site; those services publish their own privacy terms.
          </p>
        </section>

        <section aria-labelledby="privacy-applications">
          <h2 id="privacy-applications">Applications and inquiries</h2>
          <p>
            An application may include your name, email address, optional
            contact number, institution, current role, research interests,
            profile links, CV, proposal, availability, and the answers you
            provide in the form. A contact inquiry contains the name, email
            address, topic, and message you submit. We use this information only
            to assess or respond to the submission, coordinate any next steps,
            and keep an accountable record of the decision.
          </p>
          <p>
            Application records are kept for up to {applicationRetentionMonths}{" "}
            months by default, unless a longer period is required to manage an
            active relationship, meet a legal obligation, or resolve a dispute.
            The retention period is configurable by the lab. Records that no
            longer need to be kept are deleted or anonymized.
          </p>
        </section>

        <section aria-labelledby="privacy-files">
          <h2 id="privacy-files">File storage</h2>
          <p>
            Application files such as CVs and proposals are stored in private
            object storage. Private files are not published on the website.
            Access is limited to authorized lab members who need the files to
            review a submission or administer the service. Public research files
            and images are stored separately and may be available to anyone.
          </p>
        </section>

        <section aria-labelledby="privacy-accounts">
          <h2 id="privacy-accounts">Member accounts</h2>
          <p>
            Member accounts store identity and sign-in information, role and
            profile data, active sessions, and work created inside the portal.
            We use this data to secure the account, apply permissions, support
            collaboration, and keep an audit trail of important changes.
            Passwords are stored only as secure hashes; the lab does not store
            readable passwords.
          </p>
        </section>

        <section aria-labelledby="privacy-analytics">
          <h2 id="privacy-analytics">Website analytics</h2>
          <p>
            The public website uses Plausible Analytics to understand aggregate
            use of the site. Plausible is configured without cookies and is not
            used here to create advertising profiles or follow visitors across
            websites. The site does not require a tracking-cookie banner for
            this analytics setup.
          </p>
        </section>

        <section aria-labelledby="privacy-sharing">
          <h2 id="privacy-sharing">When information is shared</h2>
          <p>
            We share personal information only with service providers that
            operate the website, email, database, authentication, and file
            storage; with authorized reviewers involved in a submission; when
            you ask us to share it; or when disclosure is required by law. We do
            not sell personal information.
          </p>
        </section>

        <section aria-labelledby="privacy-control">
          <h2 id="privacy-control">Access, correction, and deletion</h2>
          <p>
            You may ask what personal information we hold about you, request a
            correction, withdraw an application, or request deletion where the
            lab is not required to retain the record. Send the request from the
            email address connected to the record so we can verify it.
          </p>
          <p>
            Contact: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2 id="privacy-changes">Changes to this policy</h2>
          <p>
            If this policy changes, the revised text and its effective date will
            be published on this page. Material changes affecting existing
            member accounts or active applications will also be communicated
            directly where practical.
          </p>
        </section>
      </div>
    </article>
  );
}
