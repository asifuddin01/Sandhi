import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  getViewer,
  PROFILE_SETUP_PATH,
  TWO_FACTOR_SETUP_PATH,
} from "@/lib/authz";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Reachable before a person has finished setting themselves up: the ways in,
 * and the page where two-factor authentication is turned on. Everything else
 * in the portal waits behind that.
 */
const OPEN_PATHS = [
  "/portal/sign-in",
  "/portal/two-factor",
  "/portal/accept-invite",
  "/portal/reset-password",
  // Where the authenticator is enrolled. Gating this would be a locked door
  // with the key behind it.
  "/portal/security",
];

/**
 * Where the profile is written. Not an open path: a person still needs their
 * second factor before they get here. It is only exempt from the rung that
 * sends people to it, which would otherwise be a redirect to itself.
 */
const PROFILE_PATH = "/portal/profile";

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isOpen(pathname: string): boolean {
  return OPEN_PATHS.some((path) => matches(pathname, path));
}

/**
 * The gate every member passes once. It lives in the layout rather than in
 * each page because a gate that has to be remembered is a gate that will be
 * forgotten the next time someone adds a page.
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (isOpen(pathname)) return children;

  // A signed-out visitor is already being sent to sign in, by the proxy and
  // by the page itself; this gate has nothing to add.
  const viewer = await getViewer();
  if (!viewer) return children;

  // In order. Someone who has just set their second factor is asked for their
  // profile next, and not before — two demands at once is how people give up
  // halfway and leave an account half-made.
  if (!viewer.secondFactor) redirect(TWO_FACTOR_SETUP_PATH);
  // An account with no member record has no profile to complete; it is not
  // held here, because nothing it could do would let it through.
  if (
    viewer.member &&
    !viewer.member.profileComplete &&
    !matches(pathname, PROFILE_PATH)
  ) {
    redirect(PROFILE_SETUP_PATH);
  }

  return children;
}
