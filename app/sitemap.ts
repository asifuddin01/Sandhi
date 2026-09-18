import type { MetadataRoute } from "next";

import { getPublicSitemapEntries } from "@/lib/public-content";
import { getSiteSettings } from "@/lib/site-settings";
import { hiddenSectionPaths, isPathHidden } from "@/lib/site-settings-schema";

export const dynamic = "force-dynamic";

const origin = "https://sandhiresearch.org";

const staticPages: Array<{
  path: string;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "yearly", priority: 0.7 },
  { path: "/research", changeFrequency: "monthly", priority: 0.9 },
  { path: "/projects", changeFrequency: "weekly", priority: 0.9 },
  { path: "/publications", changeFrequency: "weekly", priority: 0.9 },
  { path: "/people", changeFrequency: "monthly", priority: 0.8 },
  { path: "/news", changeFrequency: "weekly", priority: 0.8 },
  { path: "/events", changeFrequency: "weekly", priority: 0.7 },
  { path: "/opportunities", changeFrequency: "weekly", priority: 0.8 },
  { path: "/resources", changeFrequency: "monthly", priority: 0.7 },
  { path: "/insights", changeFrequency: "weekly", priority: 0.8 },
  { path: "/open-science", changeFrequency: "yearly", priority: 0.6 },
  { path: "/partners", changeFrequency: "monthly", priority: 0.6 },
  { path: "/join", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [dynamicPages, settings] = await Promise.all([
    getPublicSitemapEntries(),
    getSiteSettings(),
  ]);
  const hidden = hiddenSectionPaths(settings);
  const shown = <Page extends { path: string }>(page: Page) =>
    !isPathHidden(page.path, hidden);
  const pages: MetadataRoute.Sitemap = [
    ...staticPages.filter(shown).map((page) => ({
      url: `${origin}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...dynamicPages.filter(shown).map((page) => ({
      url: `${origin}${page.path}`,
      lastModified: page.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return Array.from(new Map(pages.map((page) => [page.url, page])).values());
}
