import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getPublicGraph } from "@/lib/public-graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The research connections map, published records only. */
export const GET = apiRoute({ cache: PUBLIC_CACHE }, () => getPublicGraph());
