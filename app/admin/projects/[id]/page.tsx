import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/admin/Admin.module.css";
import { getProjectForEdit, getProjectOptions } from "@/lib/admin/projects";
import { requireCapability } from "@/lib/authz";

import { ProjectEditor } from "../ProjectEditor";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  await requireCapability("projects:manage", `/admin/projects/${id}`);
  const [project, options] = await Promise.all([
    getProjectForEdit(id),
    getProjectOptions(id),
  ]);
  if (!project) notFound();
  const { created } = await searchParams;

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/projects">Projects</Link>
      </nav>
      <header className={styles.header}>
        <h1>{project.title}</h1>
        <p className={styles.rowActions}>
          <Link href={`/admin/projects/${project.id}/preview`}>Preview</Link>
          {project.state === "PUBLISHED" ? (
            <Link href={`/projects/${project.slug}`}>View on site</Link>
          ) : null}
        </p>
        {created ? (
          <p className={styles.notice} role="status">
            Project created.
          </p>
        ) : null}
      </header>
      <ProjectEditor project={project} options={options} />
    </>
  );
}
