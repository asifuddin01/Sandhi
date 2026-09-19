import type { Metadata } from "next";

import { ContentIndex, StatusCell } from "@/components/admin/ContentIndex";
import { getPartnersIndex } from "@/lib/admin/partners";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { PARTNER_KINDS } from "@/lib/partner-content";
import { humanizeEnum } from "@/lib/public-content";

import { bulkPartnersAction } from "./actions";

export const metadata: Metadata = { title: "Partners" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function PartnersAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("partners:manage", "/admin/partners");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const kind = single(params.kind);
  const { partners, total, page, pages } = await getPartnersIndex({
    query,
    state,
    kind,
    page: Number(single(params.page)) || 1,
  });

  return (
    <ContentIndex
      heading="Partners"
      intro="Universities, labs, companies, and funders the lab works with, in the order shown on the Partners page."
      newHref="/admin/partners/new"
      newLabel="Add partner"
      basePath="/admin/partners"
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
          options: PARTNER_KINDS.map((value) => ({
            value,
            label: humanizeEnum(value),
          })),
        },
      ]}
      columns={["Kind", "Order", "Status"]}
      rows={partners.map((partner) => ({
        id: partner.id,
        title: partner.name,
        href: `/admin/partners/${partner.id}`,
        cells: [
          humanizeEnum(partner.kind),
          String(partner.sortOrder),
          <StatusCell key="status" state={partner.state} />,
        ],
      }))}
      bulkAction={bulkPartnersAction}
      noun={{ one: "partner", many: "partners" }}
      emptyText="No partners yet."
      page={page}
      pages={pages}
      total={total}
    />
  );
}
