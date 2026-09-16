import Link from "next/link";

import styles from "./ErrorPages.module.css";

export default function NotFound() {
  return (
    <div className={styles.errorPage}>
      <div className={styles.stoppedThreads} aria-hidden="true">
        <span className={styles.threadLeft} />
        <span className={styles.threadRight} />
      </div>
      <div className={styles.content}>
        <span className={styles.code}>404</span>
        <h1>No junction here.</h1>
        <p>This path does not connect to anything yet.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/">
            Go home
          </Link>
          <Link className={styles.secondary} href="/publications">
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
