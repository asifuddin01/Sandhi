import { apiRoute } from "@/lib/api/handler";
import { viewerPayload } from "@/lib/api/mobile-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Who is signed in, and what this deployment lets them do. */
export const GET = apiRoute(
  { auth: true, requireClient: false },
  ({ viewer }) => viewerPayload(viewer!),
);
