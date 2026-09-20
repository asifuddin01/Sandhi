import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildContentSecurityPolicy,
  REPORTING_ENDPOINTS,
} from "@/lib/security-headers";

// Reachable without a session: signing in, resetting, and accepting invites.
const openPortalPaths = [
  "/portal/sign-in",
  "/portal/reset-password",
  "/portal/accept-invite",
  // The second sign-in step, before a session exists.
  "/portal/two-factor",
];

function needsSession(pathname: string): boolean {
  const protectedArea =
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  if (!protectedArea) return false;
  return !openPortalPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Sends signed-out visitors away from the portal and administration, and
 * issues a fresh nonce for every page request. Next.js reads the policy from
 * the request headers and applies the nonce to its own scripts; the root
 * layout applies it to the inline preference script.
 */
export function proxy(request: NextRequest) {
  // A fast first gate only: pages and actions still verify the session and
  // the person's role on the server.
  const { pathname, search } = request.nextUrl;
  if (needsSession(pathname) && !getSessionCookie(request)) {
    const signIn = new URL("/portal/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
    upgradeInsecureRequests: request.nextUrl.protocol === "https:",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // The portal layout gates on where the request is going, and a layout is
  // not told its own path.
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Reporting-Endpoints", REPORTING_ENDPOINTS);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API responses, build assets, and files with an extension
      // (icons, feeds, sitemaps, calendar downloads) carry no scripts.
      source: "/((?!api|_next/static|_next/image|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
