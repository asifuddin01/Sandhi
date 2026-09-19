import { buildAssetLinks } from "@/lib/app-links";

export const dynamic = "force-dynamic";

/**
 * Android App Links verification. Served even when empty, so a misconfigured
 * deployment answers with "no app" rather than a 404 that looks like an outage.
 */
export function GET() {
  return Response.json(buildAssetLinks(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
