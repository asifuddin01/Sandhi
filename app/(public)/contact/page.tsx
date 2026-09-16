import type { Metadata } from "next";

import { ContactForm } from "@/components/forms/ContactForm";
import { contactTopics } from "@/lib/forms";
import { getContactAddresses, getContactLocation } from "@/lib/forms-contact";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact SANDHI Research Lab about research, collaboration, or applications.",
};

export default async function ContactPage() {
  const [addresses, location] = await Promise.all([
    getContactAddresses(),
    getContactLocation(),
  ]);

  return (
    <div className={styles.page}>
      <header className={`page-shell ${styles.header}`}>
        <h1>SANDHI Research Lab</h1>
        <p className={styles.lead}>
          Choose the closest thread below, or send a general inquiry.
        </p>
      </header>

      <div className={`page-shell ${styles.layout}`}>
        <section
          className={styles.addresses}
          aria-labelledby="contact-addresses"
        >
          <h2 id="contact-addresses">Email us directly</h2>
          <dl>
            {contactTopics.map(({ value, label }) => (
              <div key={value}>
                <dt>{label}</dt>
                <dd>
                  <a href={`mailto:${addresses[value]}`}>{addresses[value]}</a>
                </dd>
              </div>
            ))}
          </dl>
          {location ? (
            <div className={styles.location}>
              <h3>Location</h3>
              <p>{location}</p>
            </div>
          ) : null}
        </section>

        <ContactForm siteKey={process.env.TURNSTILE_SITE_KEY} />
      </div>
    </div>
  );
}
