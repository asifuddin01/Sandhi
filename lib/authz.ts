import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  can,
  parseSystemRole,
  type Capability,
  type SystemRoleValue,
} from "@/lib/permissions";

export interface Viewer {
  userId: string;
  /** The session this request belongs to (never its token). */
  sessionId: string;
  email: string;
  name: string;
  role: SystemRoleValue;
  member: {
    id: string;
    slug: string;
    name: string;
    rank: string;
    status: string;
  } | null;
}

export class AuthorizationError extends Error {
  constructor() {
    super("You do not have permission to do that.");
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
    email: session.user.email,
    name: session.user.name,
    role: parseSystemRole(session.user.role),
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
  return viewer;
}

/** For server actions and route handlers: throws unless permitted. */
export async function authorize(capability: Capability): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || !can(viewer.role, capability)) {
    throw new AuthorizationError();
  }
  return viewer;
}
