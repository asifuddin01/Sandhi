import { ImageResponse } from "next/og";

import { SandhiSocialCard } from "@/components/public/SandhiSocialCard";
import { siteIdentity } from "@/content/strings";

export const alt = siteIdentity.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The picture a shared link shows when its page has none of its own. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <SandhiSocialCard
      section="Independent research lab"
      title={siteIdentity.tagline}
    />,
    size,
  );
}
