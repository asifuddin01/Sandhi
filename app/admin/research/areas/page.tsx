import type { Metadata } from "next";
import Link from "next/link";

import { ContentIndex, StatusCell } from "@/components/admin/ContentIndex";
import { getAreasIndex, getThemeOptions } from "@/lib/admin/research";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";

import { bulkAreasAction } from "../actions";

export const metadata: Metadata = { title: "Research areas" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ResearchAreasAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("research:manage", "/admin/research/areas");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const theme = single(params.theme);
  const [{ areas, total }, themes] = await Promise.all([
    getAreasIndex({ query, state, theme }),
    getThemeOptions(),
  ]);

  return (
    <ContentIndex
      heading="Research areas"
      intro={
        <>
          The areas within each{" "}
          <Link href="/admin/research">research theme</Link>, linked from
          projects, publications, people, and resources.
        </>
      }
      newHref="/admin/research/areas/new"
      newLabel="New area"
      basePath="/admin/research/areas"
      titleLabel="Name"
      query={query}
      filters={[
        {
          name: "theme",
          label: "Theme",
          value: theme,
          anyLabel: "Any theme",
          options: themes.map(({ id, name }) => ({ value: id, label: name })),
        },
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
      ]}
      columns={["Theme", "Linked work", "Status"]}
      rows={areas.map((area) => ({
        id: area.id,
        title: area.name,
        href: `/admin/research/areas/${area.id}`,
        secondary: `/research/areas/${area.slug}`,
        cells: [
          area.theme.name,
          String(
            area._count.projects +
              area._count.publications +
              area._count.members +
              area._count.resources,
          ),
          <StatusCell key="status" state={area.state} />,
        ],
      }))}
      bulkAction={bulkAreasAction}
      noun={{ one: "area", many: "areas" }}
      emptyText="No research areas yet."
      page={1}
      pages={1}
      total={total}
    />
  );
}
