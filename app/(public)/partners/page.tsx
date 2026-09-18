import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PartnerDirectory } from "@/components/partners/PartnerDirectory";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { getPublicPartners } from "@/lib/public-partners";
import { isSectionEnabled } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Universities, research labs, companies, open-source organizations, and funders working with SANDHI Research Lab.",
  alternates: { canonical: "/partners" },
};

export default async function PartnersPage() {
  if (!(await isSectionEnabled("partners"))) notFound();
  const partners = await getPublicPartners();

  return (
    <div className={styles.page}>
      <PageIntro title="Partners" />
      <PartnerDirectory partners={partners} />
    </div>
  );
}
