import { humanSize } from "@/lib/portal/attachment-input";
import type { ProjectUpdateFile } from "@/lib/public-research";

import styles from "./AttachedFiles.module.css";

/** Words for what a file is, for people who cannot see the icon of it. */
const TYPE_NAMES: Record<string, string> = {
  "application/pdf": "PDF",
  "text/markdown": "Markdown",
  "text/plain": "Text",
  "text/csv": "CSV",
  "text/tab-separated-values": "TSV",
  "application/json": "JSON",
  "application/x-ndjson": "NDJSON",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
};

function describe(file: ProjectUpdateFile): string {
  const type = TYPE_NAMES[file.contentType] ?? "File";
  return `${type} · ${humanSize(file.byteSize)}`;
}

/**
 * The files published with an update. Figures — an architecture sketch, a
 * pipeline, a chart — are drawn in place; datasets, tables and documents are
 * offered as downloads, because a table of numbers is read in a spreadsheet,
 * not squinted at in a column of prose.
 *
 * Every file is fetched through `/files/attachments/[id]`, which decides who may
 * read it. The URL is not the permission.
 */
export function AttachedFiles({ files }: { files: ProjectUpdateFile[] }) {
  if (files.length === 0) return null;

  const figures = files.filter((file) => file.kind === "FIGURE");
  const rest = files.filter((file) => file.kind !== "FIGURE");

  return (
    <div className={styles.files}>
      {figures.map((figure) => (
        <figure className={styles.figure} key={figure.id}>
          {/* Dimensions are not stored, so the intrinsic size is unknown;
              the aspect ratio is reserved in CSS instead to hold the space. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={figure.title}
            className={styles.image}
            loading="lazy"
            decoding="async"
            src={`/files/attachments/${figure.id}`}
          />
          <figcaption className={styles.caption}>
            {figure.title}
            <span className={styles.meta}> · {describe(figure)}</span>
          </figcaption>
        </figure>
      ))}

      {rest.length > 0 ? (
        <ul className={styles.list}>
          {rest.map((file) => (
            <li key={file.id}>
              <a className={styles.link} href={`/files/attachments/${file.id}`}>
                {file.title}
              </a>
              <span className={styles.meta}>{describe(file)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
