import { apiRoute, found } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getPublicInsightBySlug } from "@/lib/public-insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute<{ slug: string }>(
  { cache: PUBLIC_CACHE },
  async ({ params }) => found(await getPublicInsightBySlug(params.slug)),
);
