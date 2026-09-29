import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { workspaceMemberId } from "@/lib/portal-content";
import { authorableMembers } from "@/lib/portal/publications";

import { WriteInsight } from "../InsightForms";

export const metadata: Metadata = { title: "Write a research note" };

export default async function NewInsightPage() {
  const viewer = await requireViewer("/portal/insights/new");
  const authorable = await authorableMembers();
  const selfId = workspaceMemberId(viewer);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal/insights">Your research notes</Link>
        </p>
        <h1>Write a research note</h1>
        <p className={styles.lead}>
          It starts as a draft, yours to change. When it is ready you send it to
          be read, and a reviewer decides whether it goes on the site.
        </p>
      </header>

      <section aria-labelledby="write" className={styles.section}>
        <h2 id="write">Write it</h2>
        {selfId ? (
          <WriteInsight authorable={authorable} selfId={selfId} />
        ) : (
          <p className={styles.notice}>
            Your account is not linked to a profile yet, so a note would have
            nobody to belong to. Ask an administrator.
          </p>
        )}
      </section>
    </div>
  );
}
