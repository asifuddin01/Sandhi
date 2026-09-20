import { z } from "zod";

/**
 * What the portal asks a person for about themselves, and what counts as
 * having answered. The form, the server action and the gate all read these,
 * so what the page asks for and what the gate insists on cannot drift apart.
 *
 * Nothing here touches the database or the session, so the client form can
 * import it — that is the whole reason it is separate from `profile.ts`.
 */

export const MAX_PROFILE_NAME = 120;
export const MIN_PROFILE_NAME = 2;
export const MAX_PROFILE_TITLE = 160;
export const MAX_PROFILE_BIO = 2000;
/**
 * Short enough that nobody is writing an essay on their first day, long
 * enough that "researcher" alone does not pass.
 */
export const MIN_PROFILE_BIO = 80;
export const MAX_INTEREST = 160;
export const MAX_INTERESTS = 12;

export const PORTRAIT_RULES = {
  // No SVG: it is a document that can carry script, and a portrait is shown
  // inline on a public page.
  types: ["image/png", "image/jpeg", "image/webp"],
  extensions: {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  } as Record<string, string>,
  maximumBytes: 5 * 1024 * 1024,
  label: "photograph",
} as const;

export function portraitExtension(contentType: string): string | null {
  return PORTRAIT_RULES.extensions[contentType] ?? null;
}

export function portraitAccept(): string {
  return PORTRAIT_RULES.types.join(",");
}

export const portraitUploadSchema = z
  .object({
    contentType: z.string().trim().min(1).max(120),
    size: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (!(PORTRAIT_RULES.types as readonly string[]).includes(value.contentType)) {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: "A photograph must be a PNG, JPEG, or WebP image.",
      });
    }
    if (value.size > PORTRAIT_RULES.maximumBytes) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: `A photograph must be under ${Math.round(
          PORTRAIT_RULES.maximumBytes / (1024 * 1024),
        )} MB.`,
      });
    }
  });

/** The parts of a profile the gate looks at. */
export interface ProfileAnswers {
  name: string | null;
  bio: string | null;
  interests: readonly string[];
}

export type ProfileGap = "name" | "bio" | "interests";

export const GAP_LABELS: Record<ProfileGap, string> = {
  name: "your name",
  bio: "a short description of your work",
  interests: "at least one research interest",
};

/**
 * What is still missing, in the order the form asks for it.
 *
 * A photograph is deliberately not on this list. It is the one thing a person
 * may not have to hand on their first morning, and locking someone out of
 * their own projects over a missing picture would be a worse outcome than a
 * profile without one. The form asks for it; the gate does not insist.
 */
export function profileGaps(profile: ProfileAnswers): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if ((profile.name ?? "").trim().length < MIN_PROFILE_NAME) gaps.push("name");
  if ((profile.bio ?? "").trim().length < MIN_PROFILE_BIO) gaps.push("bio");
  if (profile.interests.filter((item) => item.trim().length > 0).length === 0) {
    gaps.push("interests");
  }
  return gaps;
}

export function isProfileComplete(profile: ProfileAnswers): boolean {
  return profileGaps(profile).length === 0;
}

/** "your name and a short description of your work" — for one sentence of prose. */
export function describeGaps(gaps: readonly ProfileGap[]): string {
  const parts = gaps.map((gap) => GAP_LABELS[gap]);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Turns the textarea of interests, one per line, into a clean list. */
export function readInterests(value: string): string[] {
  const seen = new Set<string>();
  const interests: string[] = [];
  for (const line of value.split(/[\n,]/u)) {
    const interest = line.trim().replace(/\s+/gu, " ").slice(0, MAX_INTEREST);
    if (!interest) continue;
    const key = interest.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    interests.push(interest);
    if (interests.length >= MAX_INTERESTS) break;
  }
  return interests;
}
