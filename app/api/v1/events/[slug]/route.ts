import { apiRoute, found } from "@/lib/api/handler";
import { PUBLIC_CACHE, requireSection } from "@/lib/api/public";
import { getPublicEventBySlug } from "@/lib/public-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute<{ slug: string }>(
  { cache: PUBLIC_CACHE },
  async ({ params }) => {
    await requireSection("events");
    return found(await getPublicEventBySlug(params.slug));
  },
);
