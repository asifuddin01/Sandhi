import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getResearchIndex } from "@/lib/public-research";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Themes and their areas, as the research page lists them. */
export const GET = apiRoute({ cache: PUBLIC_CACHE }, () => getResearchIndex());
