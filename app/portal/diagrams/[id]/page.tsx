import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DiagramWorkbench } from "@/components/diagrams/DiagramWorkbench";
import styles from "@/components/diagrams/Diagrams.module.css";
import portal from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { attachableProjects, getDiagram } from "@/lib/portal/diagrams";

import { deleteDiagramAction, saveDiagramAction } from "../actions";
import { DeleteDiagram } from "./DeleteDiagram";

export const metadata: Metadata = { title: "Diagram" };

export default async function DiagramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer(`/portal/diagrams/${id}`);
  const [diagram, projects] = await Promise.all([
    getDiagram(viewer, id),
    attachableProjects(viewer),
  ]);
  if (!diagram) notFound();

  return (
    <div className={portal.page}>
      <nav aria-label="Breadcrumb" className={portal.breadcrumb}>
        <Link href="/portal/diagrams">Diagrams</Link>
      </nav>
      <header className={portal.intro}>
        <h1>{diagram.title}</h1>
        {diagram.mine ? null : (
          <p className={styles.hint}>
            {diagram.owner.name} made this and shared it through{" "}
            {diagram.project?.title ?? "a project"}. You can read and export it;
            only they can change it.
          </p>
        )}
      </header>

      <DiagramWorkbench
        action={saveDiagramAction}
        id={diagram.id}
        initialTitle={diagram.title}
        initialSource={diagram.source}
        initialLayout={diagram.layout}
        initialProjectId={diagram.projectId}
        projects={projects}
        canSave={diagram.mine}
        saveLabel="Save changes"
      />

      {diagram.mine ? (
        <DeleteDiagram
          id={diagram.id}
          title={diagram.title}
          action={deleteDiagramAction}
        />
      ) : null}
    </div>
  );
}
