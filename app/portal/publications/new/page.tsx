import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { authorableMembers } from "@/lib/portal/publications";

import { PublicationForm } from "../PublicationForm";

export const metadata: Metadata = { title: "Record a publication" };

export default async function NewPublicationPage() {
  const viewer = await requireViewer("/portal/publications/new");
  const members = await authorableMembers();

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal/publications">Your publications</Link>
        </p>
        <h1>Record a publication</h1>
        <p className={styles.lead}>
          It is saved as a draft that only you and the lab can see. Send it for
          internal review when it is ready to be read.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="details">
        <h2 id="details">The paper</h2>
        <PublicationForm
          members={members}
          values={{
            title: "",
            abstract: "",
            type: "CONFERENCE",
            venueName: "",
            venueShort: "",
            year: "",
            doi: "",
            arxivId: "",
            pdfUrl: "",
            codeUrl: "",
            datasetUrl: "",
            pageUrl: "",
            authors: viewer.member
              ? [
                  {
                    memberId: viewer.member.id,
                    externalName: null,
                    externalAffiliation: null,
                    equalContribution: false,
                    corresponding: true,
                  },
                ]
              : [],
          }}
        />
      </section>
    </div>
  );
}
