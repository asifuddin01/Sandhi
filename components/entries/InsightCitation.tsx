import styles from "./Entries.module.css";

export function InsightCitation({ bibtex }: { bibtex: string }) {
  return (
    <details className={styles.bibtexPanel}>
      <summary>Cite this note</summary>
      <div className={styles.bibtexContent}>
        <pre tabIndex={0}>
          <code>{bibtex}</code>
        </pre>
      </div>
    </details>
  );
}
