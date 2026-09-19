import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/diagrams/Diagrams.module.css";
import portal from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { listDiagrams } from "@/lib/portal/diagrams";

export const metadata: Metadata = { title: "Diagrams" };

function when(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export default async function DiagramsPage() {
  const viewer = await requireViewer("/portal/diagrams");
  const diagrams = await listDiagrams(viewer);

  return (
    <div className={portal.page}>
      <header className={portal.intro}>
        <h1>Diagrams</h1>
        <p className={portal.lead}>
          Architecture diagrams, written as Mermaid and kept as text. Draw one
          here, paste one in, or read one off a photograph of a whiteboard.
        </p>
      </header>

      <p>
        <Link className="button button-primary" href="/portal/diagrams/new">
          New diagram
        </Link>
      </p>

      {diagrams.length === 0 ? (
        <p className={styles.hint}>
          Nothing yet. The first diagram you make appears here.
        </p>
      ) : (
        <div className={styles.list}>
          {diagrams.map((diagram) => (
            <article className={styles.listRow} key={diagram.id}>
              <h2>
                <Link href={`/portal/diagrams/${diagram.id}`}>
                  {diagram.title}
                </Link>
              </h2>
              <p className={styles.listMeta}>
                {diagram.project ? `${diagram.project.title} · ` : ""}
                {diagram.mine ? "Yours" : diagram.owner.name} ·{" "}
                <time dateTime={diagram.updatedAt.toISOString()}>
                  {when(diagram.updatedAt)}
                </time>
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
