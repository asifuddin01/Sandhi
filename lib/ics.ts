/**
 * One calendar event, as RFC 5545 wants it.
 *
 * Enough for a calendar application to accept the file and put the meeting
 * in somebody's day. No recurrence, no attendees, no alarms: a lab meeting
 * is a time and a place, and everything else here would be a guess about
 * software we do not control.
 */

/** A meeting with no end recorded is assumed to take an hour. */
export const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export interface IcsEvent {
  /** Stable and unique for this event, forever. */
  uid: string;
  start: Date;
  end: Date | null;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  /** When the file was written. Passed in so the output can be tested. */
  stamp?: Date;
}

function stampOf(date: Date): string {
  return `${date.toISOString().replace(/[-:]/gu, "").slice(0, 15)}Z`;
}

/** Commas, semicolons and backslashes carry meaning in a property value. */
function escape(value: string): string {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/;/gu, "\;")
    .replace(/,/gu, "\\,")
    .replace(/\r?\n/gu, "\\n");
}

/**
 * No line may exceed 75 octets. A continuation starts with one space, and
 * the split counts bytes rather than characters, because a Bengali or
 * accented letter is several bytes and a split through the middle of one
 * produces a file no calendar will read.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const pieces: string[] = [];
  let taken = 0;
  let limit = 75;
  while (taken < bytes.length) {
    let size = Math.min(limit, bytes.length - taken);
    // Back off until the slice ends on a whole character.
    while (size > 1 && (bytes[taken + size]! & 0xc0) === 0x80) size -= 1;
    pieces.push(bytes.subarray(taken, taken + size).toString("utf8"));
    taken += size;
    limit = 74; // a continuation line spends one octet on its leading space
  }
  return pieces.join("\r\n ");
}

export function toIcs(event: IcsEvent): string {
  const end =
    event.end ?? new Date(event.start.getTime() + DEFAULT_DURATION_MS);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SANDHI Research Lab//Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stampOf(event.stamp ?? new Date())}`,
    `DTSTART:${stampOf(event.start)}`,
    `DTEND:${stampOf(end)}`,
    `SUMMARY:${escape(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escape(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    ...(event.url ? [`URL:${escape(event.url)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF throughout, and a trailing one: the specification is not a matter
  // of taste here, and some calendars reject the file without it.
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
