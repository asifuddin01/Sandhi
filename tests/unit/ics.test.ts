import { describe, expect, it } from "vitest";

import { toIcs } from "@/lib/ics";

const STAMP = new Date("2026-09-29T08:00:00.000Z");

function build(over: Partial<Parameters<typeof toIcs>[0]> = {}) {
  return toIcs({
    uid: "meeting-1@sandhi",
    start: new Date("2026-10-02T09:30:00.000Z"),
    end: new Date("2026-10-02T10:30:00.000Z"),
    title: "Corpus review",
    stamp: STAMP,
    ...over,
  });
}

describe("toIcs", () => {
  it("writes an event a calendar can read", () => {
    const ics = build();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261002T093000Z");
    expect(ics).toContain("DTEND:20261002T103000Z");
    expect(ics).toContain("DTSTAMP:20260929T080000Z");
    expect(ics).toContain("SUMMARY:Corpus review");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("ends every line with CRLF, the last one included", () => {
    const ics = build();
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(/[^\r]\n/u.test(ics)).toBe(false);
  });

  it("gives an hour to a meeting with no end recorded", () => {
    expect(build({ end: null })).toContain("DTEND:20261002T103000Z");
  });

  it("escapes the characters that carry meaning", () => {
    const ics = build({
      title: "Review; part 1, 2 and 3",
      description: "Two lines\nand a back\\slash",
    });
    expect(ics).toContain("SUMMARY:Review\; part 1\\, 2 and 3");
    expect(ics).toContain("DESCRIPTION:Two lines\\nand a back\\\\slash");
  });

  it("leaves out what was not given", () => {
    const ics = build();
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("URL:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("folds a long line and marks the continuation with a space", () => {
    const ics = build({ title: "x".repeat(200) });
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
    }
    // Unfolding puts it back exactly as it went in.
    expect(ics.replace(/\r\n /gu, "")).toContain(`SUMMARY:${"x".repeat(200)}`);
  });

  it("never splits a multi-byte letter down the middle", () => {
    // Bengali: every one of these is three bytes.
    const title = "সন্ধি".repeat(40);
    const ics = build({ title });
    expect(ics).not.toContain("�");
    expect(ics.replace(/\r\n /gu, "")).toContain(`SUMMARY:${title}`);
  });
});
