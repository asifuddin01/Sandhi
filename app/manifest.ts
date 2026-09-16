import type { MetadataRoute } from "next";

import { siteIdentity } from "@/content/strings";
import { themeMetadataColors } from "@/styles/tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteIdentity.name,
    short_name: siteIdentity.shortName,
    description:
      "An independent research lab exploring artificial intelligence and computational science.",
    start_url: "/",
    display: "standalone",
    background_color: themeMetadataColors.dark,
    theme_color: themeMetadataColors.dark,
    icons: [
      {
        src: "/brand/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/brand/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
