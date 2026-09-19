import type { Metadata } from "next";

import {
  ContentIndex,
  formatAdminTime,
  StatusCell,
} from "@/components/admin/ContentIndex";
import { getOpportunitiesIndex } from "@/lib/admin/opportunities";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import {
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_KINDS,
  type PublicOpportunityKind,
} from "@/lib/public-opportunities";

import { bulkOpportunitiesAction } from "./actions";

export const metadata: Metadata = { title: "Opportunities" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function OpportunitiesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("opportunities:manage", "/admin/opportunities");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const kind = single(params.kind);
  const { opportunities, total, page, pages } = await getOpportunitiesIndex({
    query,
    state,
    kind,
    page: Number(single(params.page)) || 1,
  });
  const now = new Date();

  return (
    <ContentIndex
      heading="Opportunities"
      intro="Open positions, internships, and collaborations. An opening leaves the site on its own once its deadline passes."
      newHref="/admin/opportunities/new"
      newLabel="New opportunity"
      basePath="/admin/opportunities"
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
          options: OPPORTUNITY_KINDS.map((value) => ({
            value,
            label: OPPORTUNITY_KIND_LABELS[value],
          })),
        },
      ]}
      columns={["Kind", "Deadline", "Applications", "Status"]}
      rows={opportunities.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        href: `/admin/opportunities/${opportunity.id}`,
        secondary: `/opportunities/${opportunity.slug}`,
        cells: [
          OPPORTUNITY_KIND_LABELS[opportunity.kind as PublicOpportunityKind],
          opportunity.deadline ? (
            <time key="deadline" dateTime={opportunity.deadline.toISOString()}>
              {formatAdminTime(opportunity.deadline)}
            </time>
          ) : (
            "Open"
          ),
          String(opportunity._count.applications),
          opportunity.state === "PUBLISHED" &&
          opportunity.deadline &&
          opportunity.deadline < now ? (
            "Closed"
          ) : (
            <StatusCell key="status" state={opportunity.state} />
          ),
        ],
      }))}
      bulkAction={bulkOpportunitiesAction}
      noun={{ one: "opportunity", many: "opportunities" }}
      emptyText="No opportunities yet."
      page={page}
      pages={pages}
      total={total}
    />
  );
}
