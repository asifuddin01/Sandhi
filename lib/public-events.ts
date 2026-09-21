import "server-only";

import { cachedPublicRead } from "@/lib/cache";
import { cacheTags } from "@/lib/cache-tags";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { publicEventWhere } from "@/lib/visibility";

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  kind: string;
  abstract: string;
  speakers: string[];
  startsAt: Date;
  endsAt: Date | null;
  timeZone: string;
  location: string | null;
  isOnline: boolean;
  registerUrl: string | null;
  builtInRegistration: boolean;
  recordingUrl: string | null;
  slidesUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicEventGroups {
  upcoming: PublicEvent[];
  past: PublicEvent[];
}

const eventSelect = {
  id: true,
  slug: true,
  title: true,
  kind: true,
  abstract: true,
  speakers: true,
  startsAt: true,
  endsAt: true,
  timeZone: true,
  location: true,
  isOnline: true,
  registerUrl: true,
  allowRegistration: true,
  recordingUrl: true,
  slidesUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventSelect;

type EventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

function safeExternalUrl(value: string | null): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function eventHasEnded(
  event: Pick<PublicEvent, "startsAt" | "endsAt">,
  now = new Date(),
): boolean {
  return (event.endsAt ?? event.startsAt).getTime() < now.getTime();
}

export function eventRegistrationIsOpen(
  event: Pick<PublicEvent, "startsAt">,
  now = new Date(),
): boolean {
  return event.startsAt.getTime() > now.getTime();
}

function toPublicEvent(row: EventRow, now: Date): PublicEvent | null {
  // Keep this defense even though every query also uses publicEventWhere().
  if (row.kind === "INTERNAL") return null;

  const ended = eventHasEnded(row, now);
  const registrationOpen = eventRegistrationIsOpen(row, now);
  const registerUrl = registrationOpen
    ? safeExternalUrl(row.registerUrl)
    : null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    abstract: row.abstract,
    speakers: row.speakers,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timeZone: row.timeZone,
    location: row.location,
    isOnline: row.isOnline,
    registerUrl,
    builtInRegistration:
      registrationOpen && row.allowRegistration && registerUrl === null,
    recordingUrl: ended ? safeExternalUrl(row.recordingUrl) : null,
    slidesUrl: ended ? safeExternalUrl(row.slidesUrl) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function partitionPublicEvents(
  events: PublicEvent[],
  now = new Date(),
): PublicEventGroups {
  const upcoming: PublicEvent[] = [];
  const past: PublicEvent[] = [];

  for (const event of events) {
    (eventHasEnded(event, now) ? past : upcoming).push(event);
  }

  upcoming.sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );
  past.sort(
    (left, right) => right.startsAt.getTime() - left.startsAt.getTime(),
  );
  return { upcoming, past };
}

/**
 * The rows, with their times as ISO strings.
 *
 * `publicEventWhere()` never consults the clock, so which events are public
 * is cacheable. What the clock decides — whether registration is still open,
 * whether a recording may be shown, upcoming or past — is decided per
 * request in `getPublicEvents`, because a cached entry would freeze the
 * moment it was filled and an event would never move into the past.
 *
 * The times cross as strings because the cache stores JSON; `CacheSafe`
 * refuses a `Date`.
 */
type CachedEventRow = Omit<
  EventRow,
  "startsAt" | "endsAt" | "createdAt" | "updatedAt"
> & {
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const cachedEventRows = cachedPublicRead(
  "public-events",
  [cacheTags.events],
  async (): Promise<CachedEventRow[]> => {
    if (!isDatabaseConfigured()) return [];
    const rows = await getDb().event.findMany({
      where: publicEventWhere(),
      orderBy: { startsAt: "asc" },
      select: eventSelect,
    });
    return rows.map((row) => ({
      ...row,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
);

export async function getPublicEvents(
  now = new Date(),
): Promise<PublicEventGroups> {
  if (!isDatabaseConfigured()) return { upcoming: [], past: [] };

  const events = (await cachedEventRows())
    .map((row) =>
      toPublicEvent(
        {
          ...row,
          startsAt: new Date(row.startsAt),
          endsAt: row.endsAt ? new Date(row.endsAt) : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        now,
      ),
    )
    .filter((event): event is PublicEvent => event !== null);
  return partitionPublicEvents(events, now);
}

export const getPublicEventBySlug = cache(
  async (slug: string, now = new Date()): Promise<PublicEvent | null> => {
    if (!isDatabaseConfigured()) return null;

    const row = await getDb().event.findFirst({
      where: { AND: [publicEventWhere(), { slug }] },
      select: eventSelect,
    });
    return row ? toPublicEvent(row, now) : null;
  },
);

/**
 * Any event by id, as its public page would show it, for the admin preview.
 * Internal events have no public page, so they preview as null.
 */
export async function getEventForPreview(
  id: string,
  now = new Date(),
): Promise<PublicEvent | null> {
  if (!isDatabaseConfigured()) return null;
  const row = await getDb().event.findUnique({
    where: { id },
    select: eventSelect,
  });
  return row ? toPublicEvent(row, now) : null;
}
