import styles from "@/components/public/ResearchPages.module.css";

const statusLabels: Record<string, string> = {
  PROPOSED: "Proposed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  SUBMITTED: "Submitted",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function StatusLabel({ status }: { status: string }) {
  return (
    <span className={styles.status} data-status={status}>
      {statusLabels[status] ?? status}
    </span>
  );
}
