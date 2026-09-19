import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, param } from "@/lib/api/public";
import { getPublicInsights } from "@/lib/public-insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute(
  { cache: PUBLIC_CACHE },
  async ({ searchParams }) => ({
    insights: await getPublicInsights(param(searchParams, "kind", 40)),
  }),
);
