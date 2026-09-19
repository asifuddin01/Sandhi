import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE } from "@/lib/api/public";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * What the app needs to match the website's shell: which sections exist, where
 * to write, and any notice shown above every page. Administrative settings
 * (retention, for one) are not part of this.
 */
export const GET = apiRoute({ cache: PUBLIC_CACHE }, async () => {
  const settings = await getSiteSettings();
  return {
    contact: settings.contact,
    location: settings.location,
    social: settings.social,
    features: settings.features,
    maintenanceBanner: settings.maintenanceBanner,
  };
});
