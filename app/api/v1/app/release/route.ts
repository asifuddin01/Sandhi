import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * What the installed app compares itself against on launch: the current
 * release per platform, and the oldest version this deployment still answers.
 * The same rows the /app download page reads, so the two can never disagree.
 */
export const GET = apiRoute({ cache: PUBLIC_CACHE }, async () => {
  const { mobileApp } = await getSiteSettings();
  return {
    published: mobileApp.enabled,
    minimumVersion: mobileApp.minimumVersion,
    android: mobileApp.enabled ? mobileApp.android : null,
    ios: mobileApp.enabled ? mobileApp.ios : null,
  };
});
