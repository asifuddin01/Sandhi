import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  can,
  parseSystemRole,
  requiresTwoFactor,
  type Capability,
  type SystemRoleValue,
} from "@/lib/permissions";

/** Where staff without two-factor authentication are sent to set it up. */
export const TWO_FACTOR_SETUP_PATH = "/portal/security?setup=two-factor";

/**
 * Sessions last a week for the portal, but administration needs a sign-in
 * from the last twelve hours, so a session left open on a borrowed or lost
 * device stops carrying administrative power by the next day.
 */
export const STAFF_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const STAFF_SESSION_EXPIRED_MESSAGE =
  "For your safety, sign in again to use administration.";

function staffSessionExpired(viewer: Viewer, now = Date.now()): boolean {
  return now - viewer.sessionCreatedAt.getTime() > STAFF_SESSION_MAX_AGE_MS;
}

export interface Viewer {
  userId: string;
  /** The session this request belongs to (never its token). */
  sessionId: string;
  sessionCreatedAt: Date;
  email: string;
  name: string;
  role: SystemRoleValue;
  twoFactorEnabled: boolean;
  member: {
    id: string;
    slug: string;
    name: string;
    rank: string;
    status: string;
  } | null;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}

/** The signed-in person for this request, or null. Suspended members are signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isDatabaseConfigured()) return null;

  const session = await getAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) return null;

  const member = await getDb().member.findUnique({
    where: { userId: session.user.id },
    select: { id: true, slug: true, name: true, rank: true, status: true },
  });
  if (member?.status === "SUSPENDED") return null;

  return {
    userId: session.user.id,
    sessionId: session.session.id,
    sessionCreatedAt: new Date(session.session.createdAt),
    email: session.user.email,
    name: session.user.name,
    role: parseSystemRole(session.user.role),
    twoFactorEnabled: session.user.twoFactorEnabled === true,
    member,
  };
});

/** For pages: send anyone signed out to sign in, then back to `nextPath`. */
export async function requireViewer(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(`/portal/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return viewer;
}

/** For pages: people without the capability see "not found", not the page. */
export async function requireCapability(
  capability: Capability,
  nextPath: string,
): Promise<Viewer> {
  const viewer = await requireViewer(nextPath);
  if (!can(viewer.role, capability)) notFound();
  if (requiresTwoFactor(capability) && !viewer.twoFactorEnabled) {
    redirect(TWO_FACTOR_SETUP_PATH);
  }
  if (requiresTwoFactor(capability) && staffSessionExpired(viewer)) {
    redirect(
      `/portal/sign-in?next=${encodeURIComponent(nextPath)}&reason=expired`,
    );
  }
  return viewer;
}

/** For server actions and route handlers: throws unless permitted. */
export async function authorize(capability: Capability): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || !can(viewer.role, capability)) {
    throw new AuthorizationError();
  }
  if (requiresTwoFactor(capability) && !viewer.twoFactorEnabled) {
    throw new AuthorizationError(
      "Set up two-factor authentication in Account security first.",
    );
  }
  if (requiresTwoFactor(capability) && staffSessionExpired(viewer)) {
    throw new AuthorizationError(STAFF_SESSION_EXPIRED_MESSAGE);
  }
  return viewer;
}
