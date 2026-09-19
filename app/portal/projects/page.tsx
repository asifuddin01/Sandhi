import type { Metadata } from "next";
import Link from "next/link";

import { ProjectStage } from "@/components/entries/ProjectStage";
import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { projectStatusLabel } from "@/lib/project-status";
import { getMemberProjects } from "@/lib/portal-content";

export const metadata: Metadata = { title: "My projects" };

export default async function PortalProjectsPage() {
  const viewer = await requireViewer("/portal/projects");
  const projects = await getMemberProjects(viewer);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>My projects</h1>
        <p className={styles.lead}>
          Where each project has got to, and what the team has written about it.
        </p>
      </header>

      {projects.length === 0 ? (
        <p>
          You are not on a project yet. An administrator adds people to projects
          in administration.
        </p>
      ) : (
        <ul className={styles.cardList}>
          {projects.map((project) => (
            <li className={styles.card} key={project.id}>
              <h2>
                <Link href={`/portal/projects/${project.slug}`}>
                  {project.title}
                </Link>
              </h2>
              <p className={styles.cardMeta}>
                {project.role}
                {project.isLead ? " · lead" : ""} ·{" "}
                {projectStatusLabel(project.status)}
                {project.state === "PUBLISHED" ? "" : " · not public yet"}
              </p>
              <p>{project.gloss}</p>
              <ProjectStage status={project.status} heading="Stage" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
