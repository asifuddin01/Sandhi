import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  registrationCreate: vi.fn(),
  checkRateLimit: vi.fn(),
  verifyTurnstile: vi.fn(),
  isSectionEnabled: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    event: { findFirst: mocks.eventFindFirst },
    eventRegistration: { create: mocks.registrationCreate },
  }),
  isDatabaseConfigured: () => true,
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}));

vi.mock("@/lib/site-settings", () => ({
  isSectionEnabled: mocks.isSectionEnabled,
}));

import { POST } from "@/app/api/events/[slug]/register/route";

function request(body: Record<string, unknown>, origin = "http://localhost") {
  return new Request("http://localhost/api/events/public-talk/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "x-forwarded-for": "192.0.2.10",
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Research Attendee",
  email: "ATTENDEE@EXAMPLE.ORG",
  affiliation: "Independent",
  consent: true,
  turnstileToken: "verified-token",
};

describe("event registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSectionEnabled.mockResolvedValue(true);
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfter: 0,
      mode: "development-bypass",
    });
    mocks.verifyTurnstile.mockResolvedValue({
      success: true,
      mode: "development-bypass",
    });
    mocks.eventFindFirst.mockResolvedValue({ id: "event-1" });
    mocks.registrationCreate.mockResolvedValue({ id: "registration-1" });
  });

  it("validates the public event and stores a normalized registration", async () => {
    const response = await POST(request(validBody), {
      params: Promise.resolve({ slug: "public-talk" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, windowSeconds: 600 }),
    );
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { state: "PUBLISHED", kind: { not: "INTERNAL" } },
            expect.objectContaining({
              slug: "public-talk",
              allowRegistration: true,
              registerUrl: null,
            }),
          ],
        },
      }),
    );
    expect(mocks.registrationCreate).toHaveBeenCalledWith({
      data: {
        eventId: "event-1",
        name: "Research Attendee",
        email: "attendee@example.org",
        affiliation: "Independent",
      },
      select: { id: true },
    });
  });

  it("rejects a cross-origin submission before rate limiting or persistence", async () => {
    const response = await POST(request(validBody, "https://attacker.test"), {
      params: Promise.resolve({ slug: "public-talk" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.registrationCreate).not.toHaveBeenCalled();
  });

  it("refuses every registration while Events is switched off", async () => {
    mocks.isSectionEnabled.mockResolvedValue(false);

    const response = await POST(request(validBody), {
      params: Promise.resolve({ slug: "public-talk" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.isSectionEnabled).toHaveBeenCalledWith("events");
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
    expect(mocks.registrationCreate).not.toHaveBeenCalled();
  });

  it("does not register for a closed, external, unpublished, or internal event", async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const response = await POST(request(validBody), {
      params: Promise.resolve({ slug: "public-talk" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.registrationCreate).not.toHaveBeenCalled();
  });
});
