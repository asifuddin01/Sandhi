import type { Metadata } from "next";

import { getLegalSettings } from "@/lib/public-content";

import styles from "../ContentPages.module.css";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "Terms for using the SANDHI Research Lab website, research materials, applications, and member portal.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const { contactEmail } = await getLegalSettings();

  return (
    <article className={styles.legalPage}>
      <header className={styles.pageHeader}>
        <h1>Terms of use</h1>
        <p className={styles.lead}>
          The conditions that apply when you use this website or the member
          portal.
        </p>
      </header>

      <p className={styles.reviewNotice} role="note">
        Draft for legal review. These terms must be reviewed before the site
        launches.
      </p>

      <div className={styles.legalBody}>
        <section aria-labelledby="terms-acceptance">
          <h2 id="terms-acceptance">Using the site</h2>
          <p>
            By using this website, you agree to use it lawfully and in a way
            that does not interfere with the site, its security, or another
            person&apos;s use of it. If you do not agree with these terms, do
            not use the member portal or submit information through the site.
          </p>
        </section>

        <section aria-labelledby="terms-research">
          <h2 id="terms-research">Research materials</h2>
          <p>
            Publications, datasets, software, models, images, and other research
            outputs may each carry their own license, citation request, or
            access condition. Those specific terms control your use of that
            material. When no license is stated, publication on this website
            does not by itself grant permission to copy, modify, redistribute,
            or use the material beyond what the law permits.
          </p>
          <p>
            Research descriptions may discuss work in progress. They are
            provided for scholarly communication and may change as the work
            develops. They should not be treated as medical, legal, financial,
            or other professional advice.
          </p>
        </section>

        <section aria-labelledby="terms-applications">
          <h2 id="terms-applications">Applications and submissions</h2>
          <p>
            You are responsible for providing information you are entitled to
            submit and for keeping it accurate. Submitting an application,
            proposal, or inquiry does not guarantee review by a particular date,
            an interview, funding, employment, collaboration, or acceptance. You
            keep ownership of material you submit, while giving the lab
            permission to store and review it for the purpose of handling the
            submission.
          </p>
        </section>

        <section aria-labelledby="terms-accounts">
          <h2 id="terms-accounts">Member accounts</h2>
          <ul>
            <li>
              Keep your credentials private and use only the account assigned to
              you.
            </li>
            <li>
              Tell the lab promptly if you believe an account has been
              compromised.
            </li>
            <li>
              Do not attempt to bypass permissions or access private records
              without authorization.
            </li>
            <li>Use portal data and files only for authorized lab work.</li>
          </ul>
          <p>
            The lab may suspend access to protect people, research, or systems,
            or when an account is no longer required.
          </p>
        </section>

        <section aria-labelledby="terms-links">
          <h2 id="terms-links">External services and links</h2>
          <p>
            Links to publishers, repositories, code hosts, registration systems,
            and other services are provided for convenience. SANDHI does not
            control those services and is not responsible for their
            availability, content, or terms.
          </p>
        </section>

        <section aria-labelledby="terms-availability">
          <h2 id="terms-availability">Availability and responsibility</h2>
          <p>
            The site is provided on an as-available basis. The lab works to keep
            content accurate and systems secure but cannot promise uninterrupted
            access or that every item is error-free. To the extent permitted by
            law, SANDHI is not responsible for indirect loss arising from
            reliance on the site or from an interruption outside the lab&apos;s
            reasonable control.
          </p>
        </section>

        <section aria-labelledby="terms-changes">
          <h2 id="terms-changes">Changes and contact</h2>
          <p>
            The lab may update these terms as the website and portal develop.
            Revised terms will be posted here with an effective date. Questions
            about these terms can be sent to{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
