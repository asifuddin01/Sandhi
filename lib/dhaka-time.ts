/**
 * Admin forms show and read times in Dhaka time (UTC+6; Bangladesh has not
 * observed daylight saving since 2009), whatever the browser's zone.
 */
const OFFSET_MS = 6 * 60 * 60 * 1000;
const inputPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

/** A value for `<input type="datetime-local">`, e.g. "2026-09-20T09:30". */
export function toDhakaInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** Reads a datetime-local value as Dhaka time; null when empty or invalid. */
export function fromDhakaInput(value: string): Date | null {
  const match = inputPattern.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as number[];
  const utc = Date.UTC(year!, month! - 1, day!, hour!, minute!) - OFFSET_MS;
  const date = new Date(utc);
  // Reject impossible dates such as 31 February.
  return toDhakaInput(date) === value.trim() ? date : null;
}
