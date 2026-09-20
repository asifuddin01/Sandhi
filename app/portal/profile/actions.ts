"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit, invalidate } from "@/lib/admin/actions";
import { authorize, AuthorizationError } from "@/lib/authz";
import { cacheTags } from "@/lib/cache-tags";
import { getDb } from "@/lib/db";
import { ExternalServiceError } from "@/lib/forms-services";
import { workspaceMemberId } from "@/lib/portal-content";
import {
  MAX_PROFILE_BIO,
  MAX_PROFILE_NAME,
  MAX_PROFILE_TITLE,
  MIN_PROFILE_NAME,
  isProfileComplete,
  readInterests,
} from "@/lib/portal/profile-fields";
import { assertPortraitExists } from "@/lib/storage";

export type ProfileFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const optionalUrl = z.union([
  z.literal(""),
  z.string().trim().url("Enter a complete web address, including https://."),
]);

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(MIN_PROFILE_NAME, "Enter your full name.")
    .max(MAX_PROFILE_NAME, "Keep your name under 120 characters."),
  title: z
    .string()
    .trim()
    .max(MAX_PROFILE_TITLE, "Keep your role under 160 characters."),
  bio: z
    .string()
    .trim()
    .max(MAX_PROFILE_BIO, "Keep your description within 2,000 characters."),
  orcid: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(
        /^(?:https:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/iu,
        "Enter an ORCID iD such as 0000-0000-0000-000X.",
      ),
  ]),
  scholarUrl: optionalUrl,
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
});

/**
 * A person writing their own profile. `portal:access` is the only capability
 * involved, and the member id comes from the session rather than the form, so
 * there is no id here that could be swapped for somebody else's.
 */
export async function saveProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  let memberId: string | null;
  let actorId: string;
  try {
    const viewer = await authorize("portal:access");
    memberId = workspaceMemberId(viewer);
    actorId = viewer.userId;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  if (!memberId) {
    return {
      status: "error",
      message: "Your account is not linked to a profile yet.",
    };
  }

  const parsed = profileSchema.safeParse({
    name: field(formData, "name"),
    title: field(formData, "title"),
    bio: field(formData, "bio"),
    orcid: field(formData, "orcid"),
    scholarUrl: field(formData, "scholarUrl"),
    githubUrl: field(formData, "githubUrl"),
    linkedinUrl: field(formData, "linkedinUrl"),
    websiteUrl: field(formData, "websiteUrl"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const interests = readInterests(field(formData, "interests"));
  const showOrgEmail = formData.get("showOrgEmail") === "on";

  // A picture is optional, so an absent receipt is not an error — but a
  // present one is checked against storage before it is written down.
  const fileKey = field(formData, "photoKey").trim();
  const uploadToken = field(formData, "photoToken").trim();
  const contentType = field(formData, "photoType").trim();
  let photo: { photoKey: string } | null = null;
  if (fileKey && uploadToken) {
    try {
      await assertPortraitExists({
        key: fileKey,
        memberId,
        contentType,
        uploadToken,
      });
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        return { status: "error", message: error.message };
      }
      console.error("[portal] portrait could not be confirmed:", error);
      return {
        status: "error",
        message: "That photograph could not be saved. Please try again.",
      };
    }
    // Only the key. `photoAlt` is a description of the person, not of this
    // particular picture, so a new photograph does not invalidate one that
    // was written thoughtfully — and `lib/public-research.ts` already falls
    // back to the person's name when there is none.
    photo = { photoKey: fileKey };
  }

  const complete = isProfileComplete({
    name: parsed.data.name,
    bio: parsed.data.bio,
    interests,
  });

  // Stored as null rather than "", which is what the seed and administration
  // write, so one absent link does not read differently depending on who
  // last touched the row.
  const { name, bio, ...optional } = parsed.data;
  const links = Object.fromEntries(
    Object.entries(optional).map(([key, value]) => [key, value || null]),
  );

  const slug = await getDb().$transaction(async (transaction) => {
    const before = await transaction.member.findUnique({
      where: { id: memberId },
      select: { profileCompletedAt: true },
    });

    const updated = await transaction.member.update({
      where: { id: memberId },
      data: {
        name,
        bio: bio || null,
        ...links,
        interests,
        showOrgEmail,
        ...(photo ?? {}),
        // Set once, when it is first true. Re-saving does not move the date,
        // and a later edit that empties a field takes it back to null so the
        // portal asks again.
        profileCompletedAt: complete
          ? (before?.profileCompletedAt ?? new Date())
          : null,
      },
      select: { slug: true },
    });

    // Recorded because a profile is published to a public page; the audit
    // trail is how an administrator sees who changed what and when.
    await recordAudit(transaction, {
      actorId,
      action: "member.profile",
      entity: "Member",
      entityId: memberId,
      diff: {
        completed: complete,
        photographed: photo !== null,
        interests: interests.length,
      },
    });

    return updated.slug;
  });

  invalidate(cacheTags.members, cacheTags.research);
  revalidatePath("/people");
  revalidatePath(`/people/${slug}`);
  revalidatePath("/portal", "layout");

  return {
    status: "success",
    message: complete
      ? "Your profile is saved."
      : "Saved. The portal will keep asking until your name, description, and interests are filled in.",
  };
}
