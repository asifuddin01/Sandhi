import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetail } from "@/components/entries/ProjectDetail";
import { getViewer } from "@/lib/authz";
import { membershipOf } from "@/lib/portal/progress";
import { getProjectBySlug } from "@/lib/public-research";

export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) return { title: "Project not found" };

  return {
    title: project.title,
    description: project.gloss,
    alternates: { canonical: `/projects/${project.slug}` },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  // Whoever works on this project gets their own controls here, on the page
  // they were already reading. Everyone else is not told the controls exist.
  const membership = await membershipOf(await getViewer(), slug);

  return <ProjectDetail project={project} membership={membership} />;
}
