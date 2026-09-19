import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, param } from "@/lib/api/public";
import { searchPublic } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The same search the command palette uses, behind the same limit. It stays
 * available when the limiter cannot be reached: the query is read-only and
 * already bounded.
 */
export const GET = apiRoute(
  {
    cache: PUBLIC_CACHE,
    rateLimit: {
      scope: "api-search",
      limit: 60,
      windowSeconds: 60,
      failOpen: true,
    },
  },
  async ({ searchParams }) => {
    const query = param(searchParams, "q", 120) ?? "";
    if (query.length < 2) return { results: [] };
    return { results: await searchPublic(query) };
  },
);
