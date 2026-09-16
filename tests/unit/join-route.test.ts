import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applicationCreate: vi.fn(),
  auditCreate: vi.fn(),
  opportunityFindFirst: vi.fn(),
  assertPrivateUploadExists: vi.fn(),
  sendApplicationEmails: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    application: { create: mocks.applicationCreate },
    auditLog: { create: mocks.auditCreate },
    opportunity: { findFirst: mocks.opportunityFindFirst },
  }),
  isDatabaseConfigured: () => true,
}));

vi.mock("@/lib/email", () => ({
  assertEmailConfigured: vi.fn(),
  sendApplicationEmails: mocks.sendApplicationEmails,
}));

vi.mock("@/lib/forms-contact", () => ({
  getContactAddresses: vi.fn().mockResolvedValue({
    applications: "join@sandhiresearch.org",
    collaborations: "collaborate@sandhiresearch.org",
    general: "contact@sandhiresearch.org",
    research: "research@sandhiresearch.org",
  }),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    mode: "development-bypass",
    remaining: 4,
    retryAfter: 0,
  }),
}));

vi.mock("@/lib/storage", () => ({
  assertPrivateUploadExists: mocks.assertPrivateUploadExists,
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn().mockResolvedValue({
    success: true,
    mode: "development-bypass",
  }),
}));

import { POST } from "@/app/api/join/route";

const motivation =
  "Research at a genuine disciplinary junction matters to me. ".repeat(4);

describe("join submission route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applicationCreate.mockResolvedValue({ id: "fixture-application-id" });
    mocks.auditCreate.mockResolvedValue({ id: "fixture-audit-id" });
    mocks.sendApplicationEmails.mockResolvedValue([
      { id: "applicant-email", mode: "resend" },
      { id: "admin-email", mode: "resend" },
    ]);
    mocks.assertPrivateUploadExists.mockResolvedValue(undefined);
  });

  it("verifies the private CV key, persists it, and triggers both application emails", async () => {
    const response = await POST(
      new Request("http://localhost/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RESEARCHER",
          name: "Fixture Applicant",
          email: "applicant@example.org",
          phone: "+880 1712 345678",
          institution: "Fixture University",
          currentRole: "Researcher",
          interests: ["computer-vision"],
          scholarUrl: "",
          orcid: "",
          githubUrl: "",
          linkedinUrl: "",
          websiteUrl: "",
          motivation,
          experience: "",
          proposalTitle: "",
          proposalSummary: "",
          hoursPerWeek: "10",
          consent: true,
          cvKey:
            "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
          cvUploadToken: "x".repeat(32),
          turnstileToken: "verified-token",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.assertPrivateUploadExists).toHaveBeenCalledWith({
      key: "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
      kind: "cv",
      uploadToken: "x".repeat(32),
    });
    expect(mocks.applicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cvKey:
            "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
          email: "applicant@example.org",
          phone: "+880 1712 345678",
        }),
      }),
    );
    expect(mocks.sendApplicationEmails).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fixture-application-id" }),
      "join@sandhiresearch.org",
    );
  });
});
