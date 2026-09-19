import type { Metadata } from "next";

import {
  ContentIndex,
  formatAdminTime,
  StatusCell,
} from "@/components/admin/ContentIndex";
import { EVENT_KINDS, getEventsIndex } from "@/lib/admin/events";
import { requireCapability } from "@/lib/authz";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import { humanizeEnum } from "@/lib/public-content";

import { bulkEventsAction } from "./actions";

export const metadata: Metadata = { title: "Events" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function EventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("content:manage", "/admin/events");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const kind = single(params.kind);
  const { events, total, page, pages } = await getEventsIndex({
    query,
    state,
    kind,
    page: Number(single(params.page)) || 1,
  });

  return (
    <ContentIndex
      heading="Events"
      intro="Seminars, workshops, and talks. Past events keep their page, with recordings and slides once added."
      newHref="/admin/events/new"
      newLabel="New event"
      basePath="/admin/events"
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
          options: EVENT_KINDS.map((value) => ({
            value,
            label: humanizeEnum(value),
          })),
        },
      ]}
      columns={["Kind", "Starts", "Registered", "Status"]}
      rows={events.map((event) => ({
        id: event.id,
        title: event.title,
        href: `/admin/events/${event.id}`,
        secondary: `/events/${event.slug}`,
        cells: [
          humanizeEnum(event.kind),
          <time key="starts" dateTime={event.startsAt.toISOString()}>
            {formatAdminTime(event.startsAt)}
          </time>,
          String(event._count.registrations),
          event.kind === "INTERNAL" ? (
            "Internal"
          ) : (
            <StatusCell key="status" state={event.state} />
          ),
        ],
      }))}
      bulkAction={bulkEventsAction}
      noun={{ one: "event", many: "events" }}
      emptyText="No events yet."
      page={page}
      pages={pages}
      total={total}
    />
  );
}
