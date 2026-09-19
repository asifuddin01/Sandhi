import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { ProjectDetail } from "@/components/entries/ProjectDetail";
import { requireCapability } from "@/lib/authz";
import { getProjectForPreview } from "@/lib/public-research";

export const metadata: Metadata = { title: "Preview" };

export default async function ProjectPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("projects:manage", `/admin/projects/${id}/preview`);
  const project = await getProjectForPreview(id);
  if (!project) notFound();
  return (
    <>
      <p className={styles.previewBanner} role="status">
        Preview: visitors see this page only while it is published. People and
        related work appear only when they are public too.{" "}
        <Link href={`/admin/projects/${id}`}>Back to editing</Link>
      </p>
      <ProjectDetail project={project} />
    </>
  );
}
