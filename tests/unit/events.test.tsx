import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ event: { findMany: mocks.findMany } }),
  isDatabaseConfigured: () => true,
}));

import { EventList } from "@/app/(public)/events/page";
import { formatEventTime } from "@/components/events/EventTime";
import { createEventCalendar } from "@/lib/event-calendar";
import { eventRegistrationSchema } from "@/lib/forms-event";
import { type PublicEvent, getPublicEvents } from "@/lib/public-events";

const now = new Date("2026-09-16T12:00:00.000Z");

function row(
  overrides: Partial<{
    id: string;
    slug: string;
    title: string;
    kind: "SEMINAR" | "TALK" | "INTERNAL";
    startsAt: Date;
    endsAt: Date | null;
    allowRegistration: boolean;
    registerUrl: string | null;
    recordingUrl: string | null;
    slidesUrl: string | null;
  }> = {},
) {
  return {
    id: "event-1",
    slug: "public-seminar",
    title: "Public seminar",
    kind: "SEMINAR" as const,
    abstract: "A public research seminar.",
    speakers: ["Research Speaker"],
    startsAt: new Date("2026-09-10T10:00:00.000Z"),
    endsAt: new Date("2026-09-10T11:00:00.000Z"),
    timeZone: "Asia/Dhaka",
    location: null,
    isOnline: true,
    registerUrl: null,
    allowRegistration: false,
    recordingUrl: "https://media.example.org/recording",
    slidesUrl: "https://media.example.org/slides",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-11T00:00:00.000Z"),
    ...overrides,
  };
}

describe("public events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never returns INTERNAL events and exposes recordings only after an event", async () => {
    mocks.findMany.mockResolvedValue([
      row(),
      row({
        id: "event-2",
        slug: "future-talk",
        title: "Future talk",
        kind: "TALK",
        startsAt: new Date("2026-09-20T10:00:00.000Z"),
        endsAt: new Date("2026-09-20T11:00:00.000Z"),
      }),
      row({
        id: "event-3",
        slug: "private-colloquium",
        title: "Private colloquium",
        kind: "INTERNAL",
      }),
    ]);

    const events = await getPublicEvents(now);

    expect(events.past.map(({ title }) => title)).toEqual(["Public seminar"]);
    expect(events.past[0]?.recordingUrl).toBe(
      "https://media.example.org/recording",
    );
    expect(events.upcoming.map(({ title }) => title)).toEqual(["Future talk"]);
    expect(events.upcoming[0]?.recordingUrl).toBeNull();
    expect(JSON.stringify(events)).not.toContain("Private colloquium");
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { state: "PUBLISHED", kind: { not: "INTERNAL" } },
      }),
    );
  });

  it("renders a past recording link in the event list", () => {
    const event: PublicEvent = {
      ...row(),
      kind: "SEMINAR",
      builtInRegistration: false,
      registerUrl: null,
    };
    const html = renderToStaticMarkup(<EventList events={[event]} past />);

    expect(html).toContain("Watch recording");
    expect(html).toContain("View slides");
    expect(html).toContain("Original time zone: Asia/Dhaka.");
  });
});

describe("event calendar and forms", () => {
  it("builds a downloadable UTC iCalendar event with escaped text", () => {
    const calendar = createEventCalendar({
      ...row(),
      title: "Research, evidence; practice",
      abstract: "Line one\nLine two",
    });

    expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
    expect(calendar).toContain("DTSTART:20260910T100000Z");
    expect(calendar).toContain("DTEND:20260910T110000Z");
    expect(calendar).toContain("SUMMARY:Research\\, evidence\\; practice");
    expect(calendar).toContain("DESCRIPTION:Line one\\nLine two");
    expect(calendar).toContain(
      "URL:https://sandhiresearch.org/events/public-seminar",
    );
  });

  it("formats the original event zone and validates registration data", () => {
    expect(
      formatEventTime("2026-09-16T12:00:00.000Z", null, "Asia/Dhaka", "en-GB"),
    ).toContain("18:00");

    expect(
      eventRegistrationSchema.safeParse({
        name: "A",
        email: "not-an-email",
        affiliation: "",
        consent: false,
        turnstileToken: "",
      }).success,
    ).toBe(false);
    const valid = eventRegistrationSchema.safeParse({
      name: "Research Attendee",
      email: "ATTENDEE@EXAMPLE.ORG",
      affiliation: "Independent",
      consent: true,
      turnstileToken: "verified-token",
    });
    expect(valid.success && valid.data.email).toBe("attendee@example.org");
  });
});
