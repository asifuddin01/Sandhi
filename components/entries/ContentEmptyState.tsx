import Link from "next/link";

import styles from "./Entries.module.css";

export interface ContentEmptyStateProps {
  message: string;
  action?: { href: string; label: string };
}

export function ContentEmptyState({ message, action }: ContentEmptyStateProps) {
  return (
    <div className={styles.emptyState} role="status">
      <div className={styles.emptyThread} aria-hidden="true">
        <span />
      </div>
      <p>{message}</p>
      {action ? <Link href={action.href}>{action.label}</Link> : null}
    </div>
  );
}
