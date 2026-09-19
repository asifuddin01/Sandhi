import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, param } from "@/lib/api/public";
import { getPublications } from "@/lib/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute({ cache: PUBLIC_CACHE }, ({ searchParams }) =>
  getPublications({
    q: param(searchParams, "q"),
    year: param(searchParams, "year", 4),
    type: param(searchParams, "type", 40),
    theme: param(searchParams, "theme"),
    area: param(searchParams, "area"),
    researcher: param(searchParams, "researcher"),
    venue: param(searchParams, "venue", 200),
    sort: param(searchParams, "sort") === "title" ? "title" : "newest",
  }),
);
