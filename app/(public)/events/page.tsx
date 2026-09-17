import type { Metadata } from "next";
import Link from "next/link";

import { EventTime } from "@/components/events/EventTime";
import { ContentEmptyState } from "@/components/entries/ContentEmptyState";
import { emptyStateCopy } from "@/content/strings";
import { type PublicEvent, getPublicEvents } from "@/lib/public-events";

import styles from "./events.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Seminars, workshops, talks, reading groups, and conferences from SANDHI Research Lab.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Events | SANDHI Research Lab",
    description: "Public research events from SANDHI Research Lab.",
    url: "/events",
    type: "website",
  },
};

function humanizeKind(kind: string): string {
  return kind
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function EventList({
  events,
  past,
}: {
  events: PublicEvent[];
  past: boolean;
}) {
  return (
    <ol className={styles.eventList}>
      {events.map((event) => (
        <li className={styles.event} key={event.id}>
          <div className={styles.eventTime}>
            <EventTime
              startsAt={event.startsAt.toISOString()}
              endsAt={event.endsAt?.toISOString() ?? null}
              timeZone={event.timeZone}
            />
          </div>
          <div className={styles.eventBody}>
            <div className={styles.eventMeta}>
              <span>{humanizeKind(event.kind)}</span>
              <span>{event.isOnline ? "Online" : event.location}</span>
            </div>
            <h3 className={styles.eventTitle}>
              <Link href={`/events/${event.slug}`}>{event.title}</Link>
            </h3>
            {event.speakers.length > 0 ? (
              <p className={styles.speakers}>
                {event.speakers.length === 1 ? "Speaker" : "Speakers"}:{" "}
                {event.speakers.join(", ")}
              </p>
            ) : null}
            <p className={styles.abstract}>{event.abstract}</p>
            <div className={styles.eventLinks}>
              <Link href={`/events/${event.slug}`}>Event details</Link>
              <a href={`/events/${event.slug}/calendar.ics`} download>
                Add to calendar (.ics)
              </a>
              {past && event.recordingUrl ? (
                <a href={event.recordingUrl} rel="noreferrer">
                  Watch recording
                </a>
              ) : null}
              {past && event.slidesUrl ? (
                <a href={event.slidesUrl} rel="noreferrer">
                  View slides
                </a>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function EventsPage() {
  const { upcoming, past } = await getPublicEvents();
  const hasEvents = upcoming.length > 0 || past.length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Events</h1>
        <p className={styles.lead}>
          Public conversations where researchers meet around an open question.
        </p>
      </header>

      {!hasEvents ? (
        <ContentEmptyState message={emptyStateCopy.events} />
      ) : (
        <>
          <section className={styles.section} aria-labelledby="upcoming-events">
            <header className={styles.sectionHeader}>
              <h2 id="upcoming-events">Upcoming</h2>
            </header>
            {upcoming.length > 0 ? (
              <EventList events={upcoming} past={false} />
            ) : (
              <p className={styles.emptySection}>
                No upcoming events are scheduled.
              </p>
            )}
          </section>

          {past.length > 0 ? (
            <section className={styles.section} aria-labelledby="past-events">
              <header className={styles.sectionHeader}>
                <h2 id="past-events">Past</h2>
              </header>
              <EventList events={past} past />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
