import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("not used");
  },
  isDatabaseConfigured: () => false,
}));

import {
  announcementPreview,
  DUE_SOON_DAYS,
  dueSoonUntil,
  greeting,
  PREVIEW_LIMIT,
} from "@/lib/portal/dashboard";

describe("dueSoonUntil", () => {
  it("looks exactly fourteen days ahead", () => {
    const now = new Date("2026-09-21T09:00:00.000Z");
    expect(DUE_SOON_DAYS).toBe(14);
    expect(dueSoonUntil(now).toISOString()).toBe("2026-10-05T09:00:00.000Z");
  });

  it("does not move the moment it was given", () => {
    const now = new Date("2026-09-21T09:00:00.000Z");
    dueSoonUntil(now);
    expect(now.toISOString()).toBe("2026-09-21T09:00:00.000Z");
  });
});

describe("greeting", () => {
  // Dhaka is UTC+6, so these are 06:00, 13:00, 20:00 and 00:30 there.
  it("reads the clock in Dhaka, not the server's zone", () => {
    expect(greeting(new Date("2026-09-21T00:00:00.000Z"))).toBe("Good morning");
    expect(greeting(new Date("2026-09-21T07:00:00.000Z"))).toBe(
      "Good afternoon",
    );
    expect(greeting(new Date("2026-09-21T14:00:00.000Z"))).toBe("Good evening");
  });

  it("calls half past midnight morning, not evening", () => {
    // en-GB with hour12:false formats midnight as "24", which sorts into the
    // evening branch. The hour has to come back as 0.
    expect(greeting(new Date("2026-09-20T18:30:00.000Z"))).toBe("Good morning");
  });

  it("changes at noon and at six", () => {
    expect(greeting(new Date("2026-09-21T05:59:00.000Z"))).toBe("Good morning");
    expect(greeting(new Date("2026-09-21T06:00:00.000Z"))).toBe(
      "Good afternoon",
    );
    expect(greeting(new Date("2026-09-21T11:59:00.000Z"))).toBe(
      "Good afternoon",
    );
    expect(greeting(new Date("2026-09-21T12:00:00.000Z"))).toBe("Good evening");
  });
});

describe("announcementPreview", () => {
  it("takes the marks off and leaves the words", () => {
    expect(
      announcementPreview("## Deadline\n\nThe **ICML** abstract is _due_."),
    ).toBe("Deadline The ICML abstract is due.");
  });

  it("keeps a link's words and drops its target", () => {
    expect(
      announcementPreview("See [the call](https://example.test/cfp)."),
    ).toBe("See the call.");
  });

  it("drops a code block whole, contents and all", () => {
    // A preview is one line of prose. A shell command pasted into the middle
    // of it reads as an instruction to the person skimming.
    expect(
      announcementPreview("Run this:\n\n```\nrm -rf /\n```\n\nDone."),
    ).toBe("Run this: Done.");
  });

  it("cuts a long body and marks the cut", () => {
    const preview = announcementPreview("word ".repeat(200));
    expect(preview.length).toBeLessThanOrEqual(PREVIEW_LIMIT + 1);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("leaves a short body alone", () => {
    expect(announcementPreview("Short one.")).toBe("Short one.");
  });
});
