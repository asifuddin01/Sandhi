export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  isOnline: boolean;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\r?\n/gu, "\\n")
    .replace(/,/gu, "\\,")
    .replace(/;/gu, "\\;");
}

function icsDate(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z");
}

function foldLine(line: string): string {
  const segments: string[] = [];
  let segment = "";
  let bytes = 0;

  for (const character of line) {
    const characterBytes = new TextEncoder().encode(character).length;
    const limit = segments.length === 0 ? 75 : 74;
    if (bytes + characterBytes > limit) {
      segments.push(segment);
      segment = character;
      bytes = characterBytes;
    } else {
      segment += character;
      bytes += characterBytes;
    }
  }

  segments.push(segment);
  return segments.join("\r\n ");
}

export function createEventCalendar(event: CalendarEvent): string {
  const canonicalUrl = `https://sandhiresearch.org/events/${encodeURIComponent(event.slug)}`;
  const location = event.isOnline
    ? event.location?.trim()
      ? `Online — ${event.location.trim()}`
      : "Online"
    : event.location?.trim() || "To be announced";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SANDHI Research Lab//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.id)}@sandhiresearch.org`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    ...(event.endsAt ? [`DTEND:${icsDate(event.endsAt)}`] : []),
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.abstract)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `URL:${canonicalUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
