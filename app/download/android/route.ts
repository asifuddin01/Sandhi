import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * One stable address for the current Android build, so a link shared with a
 * member keeps working after a release. The file itself is served from object
 * storage; this only points at whichever build administration published.
 */
export async function GET() {
  const { mobileApp } = await getSiteSettings();
  const android = mobileApp.enabled ? mobileApp.android : null;

  if (!android) {
    return new Response("No Android build is published.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Temporary: the target changes with every release.
  return Response.redirect(android.downloadUrl, 302);
}
