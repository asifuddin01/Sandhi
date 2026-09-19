import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, requireSection } from "@/lib/api/public";
import { getPublicEvents } from "@/lib/public-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute({ cache: PUBLIC_CACHE }, async () => {
  await requireSection("events");
  return getPublicEvents();
});
