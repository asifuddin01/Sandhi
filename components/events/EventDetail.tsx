import Link from "next/link";

import styles from "@/app/(public)/events/events.module.css";
import { EventRegistrationForm } from "@/components/events/EventRegistrationForm";
import { EventTime } from "@/components/events/EventTime";
import { Prose } from "@/components/Prose";
import { serializeJsonLd } from "@/lib/public-content";
import { eventHasEnded, type PublicEvent } from "@/lib/public-events";

function humanizeKind(kind: string): string {
  return kind
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * An event as visitors see it. The admin preview renders it too, with the
 * registration form replaced, since an unpublished event takes no sign-ups.
 */
export function EventDetail({
  event,
  preview = false,
}: {
  event: PublicEvent;
  preview?: boolean;
}) {
  const past = eventHasEnded(event);
  const canonicalUrl = `https://sandhiresearch.org/events/${event.slug}`;
  const locationName = event.isOnline
    ? event.location?.trim() || "Online"
    : event.location?.trim() || "Location to be announced";
  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.abstract,
    url: canonicalUrl,
    startDate: event.startsAt.toISOString(),
    ...(event.endsAt ? { endDate: event.endsAt.toISOString() } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: event.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location: event.isOnline
      ? {
          "@type": "VirtualLocation",
          name: locationName,
          url: canonicalUrl,
        }
      : { "@type": "Place", name: locationName },
    organizer: {
      "@type": "ResearchOrganization",
      name: "SANDHI Research Lab",
      url: "https://sandhiresearch.org",
    },
    ...(event.speakers.length > 0
      ? {
          performer: event.speakers.map((name) => ({
            "@type": "Person",
            name,
          })),
        }
      : {}),
    ...(event.registerUrl || event.builtInRegistration
      ? {
          offers: {
            "@type": "Offer",
            price: 0,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: event.registerUrl || canonicalUrl,
          },
        }
      : {}),
  };
  const breadcrumbsJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Events",
        item: "https://sandhiresearch.org/events",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: event.title,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <article className={styles.detailPage}>
      <script
        id="event-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(eventJsonLd) }}
      />
      <script
        id="event-breadcrumb-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbsJsonLd) }}
      />

      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/events">Events</Link>
          </li>
          <li aria-current="page">{event.title}</li>
        </ol>
      </nav>

      <header className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          <span>{humanizeKind(event.kind)}</span>
          <span>{past ? "Past event" : "Upcoming event"}</span>
        </div>
        <h1>{event.title}</h1>
        {event.speakers.length > 0 ? (
          <p className={styles.detailSpeakers}>
            {event.speakers.length === 1 ? "Speaker" : "Speakers"}:{" "}
            {event.speakers.join(", ")}
          </p>
        ) : null}
      </header>

      <div className={styles.detailGrid}>
        <section
          className={styles.abstractBody}
          aria-labelledby="event-abstract"
        >
          <h2 id="event-abstract">Abstract</h2>
          <Prose>{event.abstract}</Prose>
        </section>

        <aside className={styles.sidebar} aria-label="Event details">
          <section className={styles.sidebarSection}>
            <h2>When</h2>
            <div className={styles.sidebarTime}>
              <EventTime
                startsAt={event.startsAt.toISOString()}
                endsAt={event.endsAt?.toISOString() ?? null}
                timeZone={event.timeZone}
              />
            </div>
            <div className={styles.detailLinks}>
              <a href={`/events/${event.slug}/calendar.ics`} download>
                Add to calendar (.ics)
              </a>
            </div>
          </section>

          <section className={styles.sidebarSection}>
            <h2>Where</h2>
            <p>{locationName}</p>
          </section>

          {past && (event.recordingUrl || event.slidesUrl) ? (
            <section className={styles.sidebarSection}>
              <h2>Event materials</h2>
              <div className={styles.detailLinks}>
                {event.recordingUrl ? (
                  <a href={event.recordingUrl} rel="noreferrer">
                    Watch recording
                  </a>
                ) : null}
                {event.slidesUrl ? (
                  <a href={event.slidesUrl} rel="noreferrer">
                    View slides
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {!past && event.registerUrl ? (
        <section
          className={`${styles.registration} ${styles.externalRegistration}`}
        >
          <h2>Registration</h2>
          <p>Registration for this event is managed on an external site.</p>
          <a
            className="button button-primary"
            href={event.registerUrl}
            rel="noreferrer"
          >
            Register for this event
          </a>
        </section>
      ) : null}

      {!past && event.builtInRegistration ? (
        <div className={styles.registration}>
          {preview ? (
            <p>Registration opens here once the event is published.</p>
          ) : (
            <EventRegistrationForm
              slug={event.slug}
              siteKey={process.env.TURNSTILE_SITE_KEY}
            />
          )}
        </div>
      ) : null}
    </article>
  );
}
