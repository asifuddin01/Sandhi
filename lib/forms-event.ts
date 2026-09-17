import { z } from "@/lib/zod";

export const eventRegistrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(120, "Keep your name under 120 characters."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254)
    .transform((value) => value.toLowerCase()),
  affiliation: z
    .string()
    .trim()
    .max(200, "Keep your affiliation under 200 characters.")
    .optional()
    .default(""),
  consent: z.literal(true, {
    error: "Consent is required before you register.",
  }),
  turnstileToken: z.string().min(1, "Complete the anti-spam check."),
});

export type EventRegistrationSubmission = z.infer<
  typeof eventRegistrationSchema
>;
