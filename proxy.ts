import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/security-headers";

/**
 * Issues a fresh nonce for every page request. Next.js reads the policy from
 * the request headers and applies the nonce to its own scripts; the root
 * layout applies it to the inline preference script.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
    upgradeInsecureRequests: request.nextUrl.protocol === "https:",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
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
