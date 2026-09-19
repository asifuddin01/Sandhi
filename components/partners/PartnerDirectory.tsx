import Image from "next/image";

import { EmptyState } from "@/components/public/EmptyState";
import {
  accessiblePartnerLogo,
  PARTNER_EMPTY_COPY,
  PARTNER_KIND_LABELS,
  PARTNER_KINDS,
} from "@/lib/partner-content";
import type { PublicPartner } from "@/lib/public-partners";

import styles from "./PartnerDirectory.module.css";

function PartnerCard({ partner }: { partner: PublicPartner }) {
  const logo = accessiblePartnerLogo(partner.logoUrl, partner.logoAlt);
  const content = (
    <>
      <div className={styles.logoFrame}>
        {logo ? (
          <Image
            className={styles.logo}
            src={logo.src}
            alt={logo.alt}
            width={320}
            height={120}
            sizes="(max-width: 48rem) 45vw, 18rem"
            unoptimized
          />
        ) : (
          // A visual stand-in for a logo; the heading below names the partner.
          <span className={styles.wordmark} aria-hidden="true">
            {partner.name}
          </span>
        )}
      </div>
      <div className={styles.partnerText}>
        <h3>{partner.name}</h3>
        <p>{partner.description}</p>
        {partner.relationship ? (
          <p className={styles.relationship}>{partner.relationship}</p>
        ) : null}
      </div>
    </>
  );

  return partner.url ? (
    <a className={styles.partner} href={partner.url} rel="noreferrer">
      {content}
    </a>
  ) : (
    <article className={styles.partner}>{content}</article>
  );
}

export function PartnerDirectory({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0)
    return <EmptyState>{PARTNER_EMPTY_COPY}</EmptyState>;

  return (
    <div className={styles.groups}>
      {PARTNER_KINDS.map((kind) => {
        const entries = partners.filter((partner) => partner.kind === kind);
        if (entries.length === 0) return null;

        const headingId = `partner-kind-${kind.toLocaleLowerCase("en")}`;
        return (
          <section
            className={styles.group}
            aria-labelledby={headingId}
            key={kind}
          >
            <h2 id={headingId}>{PARTNER_KIND_LABELS[kind]}</h2>
            <div className={styles.grid}>
              {entries.map((partner) => (
                <PartnerCard key={partner.id} partner={partner} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
