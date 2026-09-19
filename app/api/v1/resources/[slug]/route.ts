import { apiRoute, found } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getPublicResourceBySlug } from "@/lib/public-resources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute<{ slug: string }>(
  { cache: PUBLIC_CACHE },
  async ({ params }) => found(await getPublicResourceBySlug(params.slug)),
);
