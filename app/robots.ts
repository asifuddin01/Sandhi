import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/portal", "/portal/", "/api/"],
    },
    sitemap: "https://sandhiresearch.org/sitemap.xml",
    host: "https://sandhiresearch.org",
  };
}
