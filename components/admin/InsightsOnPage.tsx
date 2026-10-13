import "server-only";

import { Decide } from "@/app/admin/insights/DecisionForms";
import { InsightQueue } from "@/app/admin/insights/InsightQueue";
import {
  getInsightQueue,
  getRecentInsightDecisions,
} from "@/lib/admin/insights";
import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { can } from "@/lib/permissions";

import styles from "./Admin.module.css";
import { OnPageBar } from "./OnPageBar";

/**
 * A reviewer's decisions, on Insights itself: the queue on the list, and
 * withdrawing on a note's own page. Drawn only for someone who may decide;
 * the action checks the same capability again. Writing a note stays in the
 * portal, where its drafts are.
 */
export async function InsightsOnPage({ slug }: { slug?: string }) {
  const viewer = await getViewer();
  if (
    !viewer ||
    !can(viewer.role, "content:manage") ||
    !isDatabaseConfigured()
  ) {
    return null;
  }

  if (slug) {
    const note = await getDb().insight.findUnique({
      where: { slug },
      select: { id: true },
    });
    return note ? (
      <OnPageBar
        actions={[
          {
            label: "Withdraw this note",
            editor: (
              <>
                <p className={styles.hint}>
                  It leaves the public site and stays in the reviewers’ list,
                  where it can be put back.
                </p>
                <Decide
                  insightId={note.id}
                  label="Withdraw it"
                  state="ARCHIVED"
                  tone="danger"
                />
              </>
            ),
            adding: false,
            own: slug,
          },
        ]}
      />
    ) : null;
  }

  const [queue, decided] = await Promise.all([
    getInsightQueue(),
    getRecentInsightDecisions(),
  ]);
  const waiting = queue.inReview.length;
  return (
    <OnPageBar
      actions={[
        {
          label: waiting ? `Review notes (${waiting} waiting)` : "Review notes",
          editor: <InsightQueue queue={queue} decided={decided} />,
          adding: false,
          own: "",
        },
      ]}
    />
  );
}
