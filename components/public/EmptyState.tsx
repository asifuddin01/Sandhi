import Link from "next/link";

import styles from "@/components/public/ResearchPages.module.css";

interface EmptyStateProps {
  children: string;
  href?: string;
  linkLabel?: string;
}

export function EmptyState({ children, href, linkLabel }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      <span className={styles.emptyThread} aria-hidden="true" />
      <p>{children}</p>
      {href && linkLabel ? (
        <Link className={styles.textLink} href={href}>
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
