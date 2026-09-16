"use client";

import { useEffect } from "react";

import styles from "./ErrorPages.module.css";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.errorPage}>
      <div className={styles.content}>
        <span className={styles.errorNode} aria-hidden="true" />
        <h1>Something broke on our side.</h1>
        <p>The error has been logged. Try again in a moment.</p>
        <button
          className={styles.primary}
          type="button"
          onClick={() => retry()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
