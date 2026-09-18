import "server-only";

import { cache } from "react";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  defaultSiteSettings,
  parseSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings-schema";

/** All site settings, read once per request. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!isDatabaseConfigured()) return defaultSiteSettings;
  const rows = await getDb().siteSetting.findMany({
    select: { key: true, value: true },
  });
  return parseSiteSettings(rows);
});

/** Whether a public section switched by a site setting is shown. */
export async function isSectionEnabled(
  section: "events" | "partners",
): Promise<boolean> {
  const { features } = await getSiteSettings();
  return section === "events" ? features.showEvents : features.showPartners;
}
