import type { NextConfig } from "next";

import {
  sensitiveRouteHeaders,
  sensitiveRoutes,
  staticSecurityHeaders,
} from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders(process.env.NODE_ENV === "production"),
      },
      ...sensitiveRoutes.map((source) => ({
        source,
        headers: sensitiveRouteHeaders(),
      })),
    ];
  },
};

export default nextConfig;
