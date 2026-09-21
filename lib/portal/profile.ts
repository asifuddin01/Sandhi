import "server-only";

import type { Viewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";
import { isApprovalField, type ApprovalField } from "@/lib/portal/profile-fields";
import { isPortraitUploadConfigured } from "@/lib/storage";

/**
 * A person's own profile, as they edit it. Everything here is keyed on the
 * viewer's member id — never on an id from the request — so this file has no
 * way to read or write somebody else's profile.
 */

export interface EditableProfile {
  id: string;
  slug: string;
  name: string;
  title: string;
  bio: string;
  interests: string[];
  photoUrl: string | null;
  photoAlt: string;
  orgEmail: string | null;
  showOrgEmail: boolean;
  scholarUrl: string;
  orcid: string;
  githubUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  isPublic: boolean;
  /** Whether a photograph can be uploaded here at all. */
  portraitsEnabled: boolean;
  /**
   * Changes this person has asked for and an administrator has not yet
   * decided. Empty for anybody who edits their profile directly.
   */
  pending: Array<{ field: ApprovalField; value: string; asked: Date }>;
}

export async function getEditableProfile(
  viewer: Viewer,
): Promise<EditableProfile | null> {
  const memberId = workspaceMemberId(viewer);
  if (!memberId || !isDatabaseConfigured()) return null;

  const member = await getDb().member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      slug: true,
      name: true,
      title: true,
      bio: true,
      interests: true,
      photoKey: true,
      photoAlt: true,
      orgEmail: true,
      showOrgEmail: true,
      scholarUrl: true,
      orcid: true,
      githubUrl: true,
      linkedinUrl: true,
      websiteUrl: true,
      isPublic: true,
      changeRequests: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { field: true, newValue: true, createdAt: true },
      },
    },
  });
  if (!member) return null;

  return {
    id: member.id,
    slug: member.slug,
    name: member.name,
    title: member.title ?? "",
    bio: member.bio ?? "",
    interests: member.interests,
    photoUrl: publicMediaUrl(member.photoKey),
    photoAlt: member.photoAlt ?? "",
    orgEmail: member.orgEmail,
    showOrgEmail: member.showOrgEmail,
    scholarUrl: member.scholarUrl ?? "",
    orcid: member.orcid ?? "",
    githubUrl: member.githubUrl ?? "",
    linkedinUrl: member.linkedinUrl ?? "",
    websiteUrl: member.websiteUrl ?? "",
    isPublic: member.isPublic,
    portraitsEnabled: isPortraitUploadConfigured(),
    pending: member.changeRequests
      .filter((request) => isApprovalField(request.field))
      .map((request) => ({
        field: request.field as ApprovalField,
        value: request.newValue,
        asked: request.createdAt,
      })),
  };
}

/**
 * Where a stored picture is served from, matching what the public pages do:
 * the public bucket when one is configured, and this site's own `/media`
 * when it is not.
 */
export function publicMediaUrl(key: string | null): string | null {
  if (!key) return null;
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) return `/media/${encoded}`;
  try {
    const normalized = new URL(base);
    if (!["http:", "https:"].includes(normalized.protocol)) return null;
    return new URL(
      encoded,
      `${normalized.toString().replace(/\/$/u, "")}/`,
    ).toString();
  } catch {
    return null;
  }
}
