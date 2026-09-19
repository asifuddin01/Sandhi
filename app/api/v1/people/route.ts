import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, param } from "@/lib/api/public";
import { getPeopleIndex } from "@/lib/public-research";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute({ cache: PUBLIC_CACHE }, ({ searchParams }) =>
  getPeopleIndex(param(searchParams, "area")),
);
