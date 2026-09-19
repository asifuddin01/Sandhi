import { apiRoute } from "@/lib/api/handler";
import { viewerPayload } from "@/lib/api/mobile-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Whether the stored token still works, and who it belongs to right now. */
export const GET = apiRoute(
  { auth: true, requireClient: false },
  ({ viewer }) => viewerPayload(viewer!),
);
