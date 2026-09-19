import type { Metadata } from "next";
import Link from "next/link";

import {
  DiagramWorkbench,
  STARTER_SOURCE,
} from "@/components/diagrams/DiagramWorkbench";
import portal from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { attachableProjects } from "@/lib/portal/diagrams";

import { createDiagramAction } from "../actions";

export const metadata: Metadata = { title: "New diagram" };

export default async function NewDiagramPage() {
  const viewer = await requireViewer("/portal/diagrams/new");
  const projects = await attachableProjects(viewer);

  return (
    <div className={portal.page}>
      <nav aria-label="Breadcrumb">
        <Link href="/portal/diagrams">Diagrams</Link>
      </nav>
      <header className={portal.intro}>
        <h1>New diagram</h1>
      </header>
      <DiagramWorkbench
        action={createDiagramAction}
        initialTitle=""
        initialSource={STARTER_SOURCE}
        initialLayout={null}
        initialProjectId={null}
        projects={projects}
        canSave
        saveLabel="Save diagram"
      />
    </div>
  );
}
