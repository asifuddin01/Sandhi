import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("not used");
  },
  isDatabaseConfigured: () => false,
}));

import { DUE_SOON_DAYS, dueSoonUntil } from "@/lib/portal/dashboard";

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
