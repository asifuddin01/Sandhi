"use client";

import { useEffect, useMemo, useRef } from "react";

function validTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return "UTC";
  }
}

export function formatEventTime(
  startsAt: string | Date,
  endsAt: string | Date | null,
  timeZone: string,
  locale = "en",
): string {
  const zone = validTimeZone(timeZone);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  };
  const formatter = new Intl.DateTimeFormat(locale, options);
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (!endsAt) return formatter.format(start);

  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  return formatter.formatRange(start, end);
}

export function EventTime({
  startsAt,
  endsAt,
  timeZone,
}: {
  startsAt: string;
  endsAt: string | null;
  timeZone: string;
}) {
  const originalLabel = useMemo(
    () => formatEventTime(startsAt, endsAt, timeZone),
    [endsAt, startsAt, timeZone],
  );
  const time = useRef<HTMLTimeElement>(null);
  const note = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!viewerZone || viewerZone === validTimeZone(timeZone)) return;

    if (time.current) {
      time.current.textContent = formatEventTime(
        startsAt,
        endsAt,
        viewerZone,
        navigator.language,
      );
    }
    if (note.current) {
      note.current.textContent = `Your local time (${viewerZone}). Originally ${originalLabel} (${timeZone}).`;
    }
  }, [endsAt, originalLabel, startsAt, timeZone]);

  return (
    <div>
      <p>
        <time ref={time} dateTime={startsAt}>
          {originalLabel}
        </time>
      </p>
      <p ref={note}>Original time zone: {timeZone}.</p>
    </div>
  );
}
