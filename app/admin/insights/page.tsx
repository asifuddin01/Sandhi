import type { Metadata } from "next";

import styles from "@/components/admin/Admin.module.css";
import {
  getInsightQueue,
  getRecentInsightDecisions,
} from "@/lib/admin/insights";
import { requireCapability } from "@/lib/authz";

import { InsightQueue } from "./InsightQueue";

export const metadata: Metadata = { title: "Research notes" };

export default async function AdminInsightsPage() {
  await requireCapability("content:manage", "/admin/insights");
  const [queue, decided] = await Promise.all([
    getInsightQueue(),
    getRecentInsightDecisions(),
  ]);

  return (
    <>
      <header className={styles.header}>
        <h1>Research notes</h1>
        <p>
          Notes members have written. One that has been handed over is waiting
          on somebody here; until it is published the public site does not know
          it exists.
        </p>
      </header>

      <InsightQueue queue={queue} decided={decided} />
    </>
  );
}
