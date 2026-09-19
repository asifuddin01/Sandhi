import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getPublicResources } from "@/lib/public-resources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute({ cache: PUBLIC_CACHE }, async () => ({
  resources: await getPublicResources(),
}));
