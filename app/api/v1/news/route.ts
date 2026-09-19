import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, param } from "@/lib/api/public";
import { getPublicNews } from "@/lib/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute(
  { cache: PUBLIC_CACHE },
  async ({ searchParams }) => ({
    news: await getPublicNews(param(searchParams, "category", 40)),
  }),
);
