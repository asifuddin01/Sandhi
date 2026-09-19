import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, param } from "@/lib/api/public";
import { getProjectsIndex, isProjectStatus } from "@/lib/public-research";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The projects list with the same filters the public page offers. */
export const GET = apiRoute({ cache: PUBLIC_CACHE }, ({ searchParams }) => {
  const status = param(searchParams, "status");
  return getProjectsIndex({
    status: status && isProjectStatus(status) ? status : undefined,
    theme: param(searchParams, "theme"),
    area: param(searchParams, "area"),
    researcher: param(searchParams, "researcher"),
  });
});
