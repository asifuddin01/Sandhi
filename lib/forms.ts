import { z } from "zod";

export const joinInterestTypes = [
  {
    value: "RESEARCHER",
    label: "Join as a researcher",
    description: "Contribute to the lab’s ongoing research programme.",
  },
  {
    value: "INTERNSHIP",
    label: "Research internship",
    description: "Apply for a supervised, time-bounded research placement.",
  },
  {
    value: "COLLABORATION",
    label: "Research collaboration",
    description:
      "Start a focused collaboration with the lab around a shared question.",
  },
  {
    value: "PROJECT_PROPOSAL",
    label: "Propose a project",
    description:
      "Introduce a new research project. You can attach a separate proposal PDF.",
  },
  {
    value: "ACADEMIC_COLLABORATION",
    label: "Academic collaboration",
    description:
      "For researchers, labs, or universities planning shared scholarly work.",
  },
  {
    value: "INDUSTRY_COLLABORATION",
    label: "Industry collaboration",
    description:
      "For organizations exploring applied research, data, or technical partnership.",
  },
] as const;

export const joinInterestValues = joinInterestTypes.map(
  ({ value }) => value,
) as [
  "RESEARCHER",
  "INTERNSHIP",
  "COLLABORATION",
  "PROJECT_PROPOSAL",
  "ACADEMIC_COLLABORATION",
  "INDUSTRY_COLLABORATION",
];

export type JoinInterestType = (typeof joinInterestValues)[number];

export const researchInterestOptions = [
  { value: "computer-vision", label: "Computer Vision" },
  { value: "language-models-and-nlp", label: "Language Models & NLP" },
  { value: "vision-language-models", label: "Vision-Language Models" },
  { value: "multimodal-ai", label: "Multimodal AI" },
  { value: "representation-learning", label: "Representation Learning" },
  { value: "causal-inference", label: "Causal Inference" },
  { value: "ai-for-science", label: "AI for Science" },
  { value: "computational-biology", label: "Computational Biology" },
] as const;

const optionalUrl = z.union([
  z.literal(""),
  z.string().trim().url("Enter a complete URL, including https://."),
]);

const optionalOrcid = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(
      /^(?:https:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i,
      "Enter an ORCID iD such as 0000-0000-0000-000X.",
    ),
]);

const optionalPhone = z
  .string()
  .trim()
  .max(40, "Keep the contact number under 40 characters.")
  .refine((value) => {
    if (!value) return true;
    if (
      !/^\+?[\d\s().-]+(?:\s?(?:x|ext\.?|extension)\s?\d{1,6})?$/i.test(value)
    ) {
      return false;
    }
    const digitCount = value.replace(/\D/g, "").length;
    return digitCount >= 7 && digitCount <= 21;
  }, "Enter a valid contact number, including the country code when relevant.");

const optionalShortText = z.string().trim().max(300).optional().default("");

export const joinInterestSchema = z.object({
  type: z.enum(joinInterestValues, {
    error: "Choose what you would like to do.",
  }),
});

export const joinAboutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Keep your name under 120 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: optionalPhone,
  institution: z
    .string()
    .trim()
    .min(2, "Enter your institution or organization.")
    .max(200),
  currentRole: z.string().trim().min(2, "Enter your current role.").max(160),
  interests: z
    .array(z.string().trim().min(1).max(160))
    .min(1, "Choose or write at least one research interest.")
    .max(12),
  scholarUrl: optionalUrl,
  orcid: optionalOrcid,
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
});

export const proposalRequiredTypes = new Set<JoinInterestType>([
  "COLLABORATION",
  "PROJECT_PROPOSAL",
  "ACADEMIC_COLLABORATION",
  "INDUSTRY_COLLABORATION",
]);

export function requiresProposal(type: JoinInterestType): boolean {
  return proposalRequiredTypes.has(type);
}

const cvOptionalTypes = new Set<JoinInterestType>([
  "ACADEMIC_COLLABORATION",
  "INDUSTRY_COLLABORATION",
]);

export function requiresCv(type: JoinInterestType): boolean {
  return !cvOptionalTypes.has(type);
}

export const joinMotivationSchema = z
  .object({
    type: z.enum(joinInterestValues),
    motivation: z
      .string()
      .trim()
      .min(150, "Tell us a little more — use at least 150 characters.")
      .max(1500, "Keep your response within 1,500 characters."),
    experience: z.string().trim().max(3000).optional().default(""),
    proposalTitle: z.string().trim().max(180).optional().default(""),
    proposalSummary: z.string().trim().max(3000).optional().default(""),
    hoursPerWeek: z
      .union([
        z.literal(""),
        z.coerce
          .number()
          .int("Use a whole number of hours.")
          .min(1, "Availability must be at least one hour per week.")
          .max(168, "Availability cannot exceed 168 hours per week."),
      ])
      .optional()
      .default(""),
    consent: z.literal(true, {
      error: "Consent is required before you submit.",
    }),
  })
  .superRefine((value, context) => {
    if (!requiresProposal(value.type)) return;

    if (value.proposalTitle.length < 4) {
      context.addIssue({
        code: "custom",
        path: ["proposalTitle"],
        message: "Enter a proposal title.",
      });
    }

    if (value.proposalSummary.length < 50) {
      context.addIssue({
        code: "custom",
        path: ["proposalSummary"],
        message: "Summarize the proposal in at least 50 characters.",
      });
    }
  });

export const joinSubmissionSchema = joinInterestSchema
  .and(joinAboutSchema)
  .and(joinMotivationSchema)
  .and(
    z.object({
      opportunitySlug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(160)
        .optional(),
      cvKey: z
        .string()
        .regex(/^applications\/pending\/[0-9a-f-]+\/cv\.pdf$/i)
        .optional(),
      cvUploadToken: z.string().min(32).max(4096).optional(),
      proposalKey: z
        .string()
        .regex(/^applications\/pending\/[0-9a-f-]+\/proposal\.pdf$/i)
        .optional(),
      proposalUploadToken: z.string().min(32).max(4096).optional(),
      turnstileToken: z.string().min(1, "Complete the anti-spam check."),
    }),
  )
  .superRefine((value, context) => {
    if (Boolean(value.cvKey) !== Boolean(value.cvUploadToken)) {
      context.addIssue({
        code: "custom",
        path: ["cvKey"],
        message: "The CV upload is incomplete.",
      });
    }

    if (requiresCv(value.type) && (!value.cvKey || !value.cvUploadToken)) {
      context.addIssue({
        code: "custom",
        path: ["cvKey"],
        message: "Upload your CV as a PDF.",
      });
    }

    if (Boolean(value.proposalKey) !== Boolean(value.proposalUploadToken)) {
      context.addIssue({
        code: "custom",
        path: ["proposalKey"],
        message: "The proposal upload is incomplete.",
      });
    }
  });

export type JoinSubmission = z.infer<typeof joinSubmissionSchema>;

export const contactTopics = [
  { value: "general", label: "General" },
  { value: "research", label: "Research" },
  { value: "collaborations", label: "Collaborations" },
  { value: "applications", label: "Applications" },
] as const;

export const contactTopicValues = contactTopics.map(({ value }) => value) as [
  "general",
  "research",
  "collaborations",
  "applications",
];

export type ContactTopic = (typeof contactTopicValues)[number];

export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  topic: z.enum(contactTopicValues, { error: "Choose a topic." }),
  message: z
    .string()
    .trim()
    .min(20, "Write at least 20 characters so we can help.")
    .max(5000, "Keep your message within 5,000 characters."),
  turnstileToken: z.string().min(1, "Complete the anti-spam check."),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

export type FieldErrors = Record<string, string>;

export function flattenZodErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }

  return errors;
}

export function cleanOptional(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export const uploadRequestSchema = z
  .object({
    kind: z.enum(["cv", "proposal"]),
    name: z.string().trim().min(1).max(255),
    size: z.number().int().positive(),
    mime: z.literal("application/pdf"),
  })
  .superRefine((value, context) => {
    const maximum = value.kind === "proposal" ? 10 : 5;
    if (value.size > maximum * 1024 * 1024) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: `The ${value.kind === "proposal" ? "proposal" : "CV"} PDF must be ${maximum} MB or smaller.`,
      });
    }
  });

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export function isValidPdf(
  file: File | null,
  kind: "cv" | "proposal" = "cv",
): string | null {
  if (!file) return "Choose a PDF file.";
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return "Use a PDF file.";
  }
  const maximum = kind === "proposal" ? 10 : 5;
  if (file.size > maximum * 1024 * 1024) {
    return `The PDF must be ${maximum} MB or smaller.`;
  }
  if (file.size === 0) return "The PDF cannot be empty.";
  return null;
}

export const blankOptionalText = optionalShortText;
