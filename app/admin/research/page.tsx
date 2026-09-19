import type { Metadata } from "next";
import Link from "next/link";

import { ContentIndex, StatusCell } from "@/components/admin/ContentIndex";
import { getThemesIndex } from "@/lib/admin/research";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";

import { bulkThemesAction } from "./actions";

export const metadata: Metadata = { title: "Research" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ResearchAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("research:manage", "/admin/research");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const { themes, total } = await getThemesIndex({ query, state });

  return (
    <ContentIndex
      heading="Research themes"
      intro={
        <>
          The broad themes of the lab’s research. Each theme holds research
          areas, which are managed on{" "}
          <Link href="/admin/research/areas">Research areas</Link>.
        </>
      }
      newHref="/admin/research/new"
      newLabel="New theme"
      basePath="/admin/research"
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
      ]}
      columns={["Areas", "Order", "Status"]}
      rows={themes.map((theme) => ({
        id: theme.id,
        title: theme.name,
        href: `/admin/research/${theme.id}`,
        secondary: `/research/${theme.slug}`,
        cells: [
          String(theme._count.areas),
          String(theme.sortOrder),
          <StatusCell key="status" state={theme.state} />,
        ],
      }))}
      bulkAction={bulkThemesAction}
      noun={{ one: "theme", many: "themes" }}
      emptyText="No research themes yet."
      page={1}
      pages={1}
      total={total}
    />
  );
}
