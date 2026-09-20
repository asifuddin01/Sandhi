import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getViewer, TWO_FACTOR_SETUP_PATH } from "@/lib/authz";

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

function isOpen(pathname: string): boolean {
  return OPEN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
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
  if (viewer && !viewer.secondFactor) redirect(TWO_FACTOR_SETUP_PATH);

  return children;
}
