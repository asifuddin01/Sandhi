import { describe, expect, it } from "vitest";

import {
  contactSubmissionSchema,
  isValidPdf,
  joinInterestTypes,
  joinMotivationSchema,
  joinSubmissionSchema,
  expectsCoverLetter,
  requiresCv,
  requiresProposal,
  requiresProposalFile,
  uploadRequestSchema,
} from "@/lib/forms";

const motivation =
  "Research at a genuine disciplinary junction matters to me. ".repeat(4);

describe("join form validation", () => {
  it("exposes the six specified interest choices", () => {
    expect(joinInterestTypes.map(({ label }) => label)).toEqual([
      "Join as a researcher",
      "Research internship",
      "Research collaboration",
      "Propose a project",
      "Academic collaboration",
      "Industry collaboration",
    ]);
  });

  it("distinguishes project, academic, and industry collaboration paths", () => {
    const descriptions = Object.fromEntries(
      joinInterestTypes.map(({ value, description }) => [value, description]),
    );

    expect(descriptions.PROJECT_PROPOSAL).toContain("proposal PDF");
    expect(descriptions.ACADEMIC_COLLABORATION).toContain("universities");
    expect(descriptions.INDUSTRY_COLLABORATION).toContain("organizations");
  });

  /**
   * The cover letter is asked for on the two paths where somebody is applying
   * to join the lab themselves. A collaboration between organizations is not
   * a job application, so it is not asked for there.
   */
  it("asks for a cover letter only from people applying to join", () => {
    expect(expectsCoverLetter("RESEARCHER")).toBe(true);
    expect(expectsCoverLetter("INTERNSHIP")).toBe(true);
    expect(expectsCoverLetter("COLLABORATION")).toBe(false);
    expect(expectsCoverLetter("PROJECT_PROPOSAL")).toBe(false);
    expect(expectsCoverLetter("ACADEMIC_COLLABORATION")).toBe(false);
    expect(expectsCoverLetter("INDUSTRY_COLLABORATION")).toBe(false);
  });

  it("does not require a CV for project, academic, or industry paths", () => {
    expect(requiresCv("RESEARCHER")).toBe(true);
    expect(requiresCv("PROJECT_PROPOSAL")).toBe(false);
    expect(requiresCv("ACADEMIC_COLLABORATION")).toBe(false);
    expect(requiresCv("INDUSTRY_COLLABORATION")).toBe(false);

    const result = joinSubmissionSchema.safeParse({
      type: "ACADEMIC_COLLABORATION",
      name: "Fixture Collaborator",
      email: "collaborator@example.org",
      phone: "",
      institution: "Example University",
      currentRole: "Researcher",
      interests: ["causal-inference"],
      scholarUrl: "",
      orcid: "",
      githubUrl: "",
      linkedinUrl: "",
      websiteUrl: "",
      motivation,
      experience: "",
      proposalTitle: "A shared research programme",
      proposalSummary:
        "We propose a shared programme with a clear research question and complementary methods.",
      hoursPerWeek: "",
      consent: true,
      turnstileToken: "verified-token",
    });

    expect(result.success).toBe(true);
  });

  it("requires proposal details for project and collaboration applications", () => {
    expect(requiresProposal("RESEARCHER")).toBe(false);
    expect(requiresProposal("PROJECT_PROPOSAL")).toBe(true);
    expect(requiresProposal("COLLABORATION")).toBe(true);
    expect(requiresProposal("ACADEMIC_COLLABORATION")).toBe(true);
    expect(requiresProposal("INDUSTRY_COLLABORATION")).toBe(true);

    const result = joinMotivationSchema.safeParse({
      type: "COLLABORATION",
      motivation,
      experience: "",
      proposalTitle: "",
      proposalSummary: "",
      hoursPerWeek: "",
      consent: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["proposalTitle", "proposalSummary"]),
      );
    }
  });

  it("requires a proposal PDF only for project proposals", () => {
    expect(requiresProposalFile("PROJECT_PROPOSAL")).toBe(true);
    expect(requiresProposalFile("COLLABORATION")).toBe(false);
    expect(requiresProposalFile("ACADEMIC_COLLABORATION")).toBe(false);
    expect(requiresProposalFile("INDUSTRY_COLLABORATION")).toBe(false);

    const base = {
      name: "Fixture Applicant",
      email: "applicant@example.org",
      phone: "",
      institution: "Example University",
      currentRole: "Researcher",
      interests: ["computer-vision"],
      scholarUrl: "",
      orcid: "",
      githubUrl: "",
      linkedinUrl: "",
      websiteUrl: "",
      motivation,
      experience: "",
      proposalTitle: "A focused research project",
      proposalSummary:
        "This proposal defines a focused question, a feasible method, and a useful intended contribution.",
      hoursPerWeek: "",
      consent: true,
      turnstileToken: "verified-token",
    };

    const missingProjectPdf = joinSubmissionSchema.safeParse({
      ...base,
      type: "PROJECT_PROPOSAL",
    });
    expect(missingProjectPdf.success).toBe(false);
    if (!missingProjectPdf.success) {
      expect(missingProjectPdf.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["proposalKey"],
            message: "Upload the project proposal as a PDF.",
          }),
        ]),
      );
    }

    expect(
      joinSubmissionSchema.safeParse({
        ...base,
        type: "PROJECT_PROPOSAL",
        proposalKey:
          "applications/pending/00000000-0000-4000-8000-000000000000/proposal.pdf",
        proposalUploadToken: "p".repeat(32),
      }).success,
    ).toBe(true);

    expect(
      joinSubmissionSchema.safeParse({
        ...base,
        type: "COLLABORATION",
        cvKey:
          "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
        cvUploadToken: "c".repeat(32),
      }).success,
    ).toBe(true);
  });

  it("accepts a complete researcher submission", () => {
    const result = joinSubmissionSchema.safeParse({
      type: "RESEARCHER",
      name: "Ada Researcher",
      email: "ada@example.org",
      phone: "+880 1712 345678",
      institution: "Example University",
      currentRole: "Researcher",
      interests: ["computer-vision"],
      scholarUrl: "",
      orcid: "0000-0000-0000-000X",
      githubUrl: "https://github.com/example",
      linkedinUrl: "",
      websiteUrl: "",
      motivation,
      experience: "",
      proposalTitle: "",
      proposalSummary: "",
      hoursPerWeek: "10",
      consent: true,
      cvKey: "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
      cvUploadToken: "x".repeat(32),
      turnstileToken: "verified-token",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hoursPerWeek).toBe(10);
  });

  it("accepts submissions without profile links and still validates legacy links", () => {
    const current = {
      type: "RESEARCHER",
      name: "Ada Researcher",
      email: "ada@example.org",
      phone: "",
      institution: "Example University",
      currentRole: "Researcher",
      interests: ["computer-vision"],
      motivation,
      experience: "",
      proposalTitle: "",
      proposalSummary: "",
      hoursPerWeek: "",
      consent: true,
      cvKey: "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
      cvUploadToken: "x".repeat(32),
      turnstileToken: "verified-token",
    };

    const withoutLinks = joinSubmissionSchema.safeParse(current);
    expect(withoutLinks.success).toBe(true);
    if (withoutLinks.success) {
      expect(withoutLinks.data).toMatchObject({
        scholarUrl: "",
        orcid: "",
        githubUrl: "",
        linkedinUrl: "",
        websiteUrl: "",
      });
    }

    expect(
      joinSubmissionSchema.safeParse({ ...current, githubUrl: "not a url" })
        .success,
    ).toBe(false);
    expect(
      joinSubmissionSchema.safeParse({ ...current, orcid: "0000-0000" })
        .success,
    ).toBe(false);
  });

  it("accepts international contact notation and rejects clearly invalid numbers", () => {
    const base = {
      name: "Ada Researcher",
      email: "ada@example.org",
      institution: "Example University",
      currentRole: "Researcher",
      interests: ["computer-vision"],
      scholarUrl: "",
      orcid: "",
      githubUrl: "",
      linkedinUrl: "",
      websiteUrl: "",
    };

    const aboutSchema = joinSubmissionSchema;
    const complete = {
      ...base,
      type: "RESEARCHER",
      motivation,
      experience: "",
      proposalTitle: "",
      proposalSummary: "",
      hoursPerWeek: "",
      consent: true,
      cvKey: "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
      cvUploadToken: "x".repeat(32),
      turnstileToken: "verified-token",
    };

    expect(
      aboutSchema.safeParse({ ...complete, phone: "+44 (0)20 7123 4567" })
        .success,
    ).toBe(true);
    expect(
      aboutSchema.safeParse({ ...complete, phone: "call me maybe" }).success,
    ).toBe(false);
    expect(
      aboutSchema.safeParse({ ...complete, phone: "1".repeat(41) }).success,
    ).toBe(false);
  });

  it("enforces PDF type and the five megabyte limit", () => {
    expect(
      isValidPdf(new File(["pdf"], "cv.pdf", { type: "application/pdf" })),
    ).toBeNull();
    expect(
      isValidPdf(new File(["text"], "cv.txt", { type: "text/plain" })),
    ).toBe("Use a PDF file.");
    expect(
      isValidPdf(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", {
          type: "application/pdf",
        }),
      ),
    ).toBe("The PDF must be 5 MB or smaller.");
  });

  it("allows proposal PDFs up to ten megabytes", () => {
    expect(
      isValidPdf(
        new File([new Uint8Array(8 * 1024 * 1024)], "proposal.pdf", {
          type: "application/pdf",
        }),
        "proposal",
      ),
    ).toBeNull();
    expect(
      isValidPdf(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "proposal.pdf", {
          type: "application/pdf",
        }),
        "proposal",
      ),
    ).toBe("The PDF must be 10 MB or smaller.");
  });

  it("enforces the ten megabyte proposal limit on upload requests", () => {
    expect(
      uploadRequestSchema.safeParse({
        kind: "proposal",
        name: "proposal.pdf",
        size: 10 * 1024 * 1024,
        mime: "application/pdf",
      }).success,
    ).toBe(true);
    expect(
      uploadRequestSchema.safeParse({
        kind: "proposal",
        name: "proposal.pdf",
        size: 10 * 1024 * 1024 + 1,
        mime: "application/pdf",
      }).success,
    ).toBe(false);
  });
});

describe("contact form validation", () => {
  it("requires a routed topic and a meaningful message", () => {
    expect(
      contactSubmissionSchema.safeParse({
        name: "A",
        email: "not-an-email",
        topic: "unknown",
        message: "Short",
        turnstileToken: "",
      }).success,
    ).toBe(false);

    expect(
      contactSubmissionSchema.safeParse({
        name: "Ada Researcher",
        email: "ada@example.org",
        topic: "research",
        message: "I would like to discuss a possible research connection.",
        turnstileToken: "verified-token",
      }).success,
    ).toBe(true);
  });
});
