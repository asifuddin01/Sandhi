import styles from "@/components/public/ResearchPages.module.css";
import { projectStatusLabel } from "@/lib/project-status";

export function StatusLabel({ status }: { status: string }) {
  return (
    <span className={styles.status} data-status={status}>
      {projectStatusLabel(status)}
    </span>
  );
}
