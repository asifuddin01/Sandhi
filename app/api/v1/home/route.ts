import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getHomeData } from "@/lib/public-home";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Everything the app's home screen shows, in one round trip. */
export const GET = apiRoute({ cache: PUBLIC_CACHE }, () => getHomeData());
