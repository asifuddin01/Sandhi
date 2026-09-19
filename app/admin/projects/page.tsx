import type { Metadata } from "next";

import {
  ContentIndex,
  formatAdminTime,
  StatusCell,
} from "@/components/admin/ContentIndex";
import { getProjectsIndex, PROJECT_STATUSES } from "@/lib/admin/projects";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { humanizeEnum } from "@/lib/public-content";

import { bulkProjectsAction } from "./actions";

export const metadata: Metadata = { title: "Projects" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ProjectsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("projects:manage", "/admin/projects");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const status = single(params.status);
  const { projects, total, page, pages } = await getProjectsIndex({
    query,
    state,
    status,
    page: Number(single(params.page)) || 1,
  });

  return (
    <ContentIndex
      heading="Projects"
      intro="The lab's projects: their question, team, research areas, and results."
      newHref="/admin/projects/new"
      newLabel="New project"
      basePath="/admin/projects"
      query={query}
      filters={[
        {
          name: "state",
          label: "State",
          value: state,
          anyLabel: "Any state",
          options: unscheduledStates.map((value) => ({
            value,
            label: publishStateLabels[value],
          })),
        },
        {
          name: "status",
          label: "Project status",
          value: status,
          anyLabel: "Any status",
          options: PROJECT_STATUSES.map((value) => ({
            value,
            label: humanizeEnum(value),
          })),
        },
      ]}
      columns={["Project status", "Team", "Visibility", "Updated"]}
      rows={projects.map((project) => ({
        id: project.id,
        title: project.featured ? `${project.title} (featured)` : project.title,
        href: `/admin/projects/${project.id}`,
        secondary: `/projects/${project.slug}`,
        cells: [
          humanizeEnum(project.status),
          String(project._count.members),
          <StatusCell key="status" state={project.state} />,
          <time key="updated" dateTime={project.updatedAt.toISOString()}>
            {formatAdminTime(project.updatedAt)}
          </time>,
        ],
      }))}
      bulkAction={bulkProjectsAction}
      noun={{ one: "project", many: "projects" }}
      emptyText="No projects yet."
      page={page}
      pages={pages}
      total={total}
    />
  );
}
