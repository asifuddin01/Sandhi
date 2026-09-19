import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { parsePublishState } from "@/lib/content-state";
import { getDb } from "@/lib/db";

export const EVENT_KINDS = [
  "SEMINAR",
  "WORKSHOP",
  "TALK",
  "READING_GROUP",
  "CONFERENCE",
  "INTERNAL",
] as const;
export type EventKindValue = (typeof EVENT_KINDS)[number];

export const EVENT_PAGE_SIZE = 50;

export async function getEventsIndex(filters: {
  query?: string;
  state?: string;
  kind?: string;
  page?: number;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const kind = EVENT_KINDS.find((value) => value === filters.kind);
  const page = Math.min(1000, Math.max(1, filters.page ?? 1));
  const where: Prisma.EventWhereInput = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(state ? { state } : {}),
    ...(kind ? { kind } : {}),
  };
  const db = getDb();
  const [events, total] = await Promise.all([
    db.event.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * EVENT_PAGE_SIZE,
      take: EVENT_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        kind: true,
        state: true,
        startsAt: true,
        _count: { select: { registrations: true } },
      },
    }),
    db.event.count({ where }),
  ]);
  return {
    events,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / EVENT_PAGE_SIZE)),
  };
}

export function getEventForEdit(id: string) {
  return getDb().event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      abstract: true,
      speakers: true,
      startsAt: true,
      endsAt: true,
      location: true,
      isOnline: true,
      registerUrl: true,
      allowRegistration: true,
      recordingUrl: true,
      slidesUrl: true,
      state: true,
      _count: { select: { registrations: true } },
    },
  });
}

/** Registrants' details are personal data: administrators only. */
export function getEventRegistrations(eventId: string) {
  return getDb().eventRegistration.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      affiliation: true,
      createdAt: true,
    },
  });
}
