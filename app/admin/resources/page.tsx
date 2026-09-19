import type { Metadata } from "next";

import {
  ContentIndex,
  formatAdminTime,
  StatusCell,
} from "@/components/admin/ContentIndex";
import { getResourcesIndex } from "@/lib/admin/resources";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import {
  RESOURCE_KIND_LABELS,
  RESOURCE_KINDS,
  type PublicResourceKind,
} from "@/lib/public-resources";

import { bulkResourcesAction } from "./actions";

export const metadata: Metadata = { title: "Resources" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ResourcesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("content:manage", "/admin/resources");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const kind = single(params.kind);
  const { resources, total, page, pages } = await getResourcesIndex({
    query,
    state,
    kind,
    page: Number(single(params.page)) || 1,
  });

  return (
    <ContentIndex
      heading="Resources"
      intro="Datasets, code, models, and tools the lab shares."
      newHref="/admin/resources/new"
      newLabel="New resource"
      basePath="/admin/resources"
      titleLabel="Name"
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
          name: "kind",
          label: "Kind",
          value: kind,
          anyLabel: "Any kind",
          options: RESOURCE_KINDS.map((value) => ({
            value,
            label: RESOURCE_KIND_LABELS[value],
          })),
        },
      ]}
      columns={["Kind", "Status", "Updated"]}
      rows={resources.map((resource) => ({
        id: resource.id,
        title: resource.name,
        href: `/admin/resources/${resource.id}`,
        secondary: `/resources/${resource.slug}`,
        cells: [
          RESOURCE_KIND_LABELS[resource.kind as PublicResourceKind],
          <StatusCell key="status" state={resource.state} />,
          <time key="updated" dateTime={resource.updatedAt.toISOString()}>
            {formatAdminTime(resource.updatedAt)}
          </time>,
        ],
      }))}
      bulkAction={bulkResourcesAction}
      noun={{ one: "resource", many: "resources" }}
      emptyText="No resources yet."
      page={page}
      pages={pages}
      total={total}
    />
  );
}
