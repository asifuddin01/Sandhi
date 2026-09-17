import { NextResponse } from "next/server";

import { rateLimitResponse } from "@/lib/forms-http";
import { requestIdentifier } from "@/lib/forms-services";
import { checkRateLimit } from "@/lib/ratelimit";
import { searchPublic } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";

  if (query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const rateLimit = await checkRateLimit({
      scope: "public-search",
      identifier: requestIdentifier(request),
      limit: 60,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  } catch (error) {
    // Search is read-only and already bounded, so it stays available when the
    // limiter cannot be reached; the failure is still logged loudly.
    console.error("[search] rate limiting unavailable:", error);
  }

  const results = await searchPublic(query);
  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
