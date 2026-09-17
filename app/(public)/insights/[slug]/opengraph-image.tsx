import { ImageResponse } from "next/og";

import { SandhiSocialCard } from "@/components/public/SandhiSocialCard";
import { getPublicInsightBySlug } from "@/lib/public-insights";

export const alt = "SANDHI Research Lab insight";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const insight = await getPublicInsightBySlug(slug);

  return new ImageResponse(
    <SandhiSocialCard
      section="Insights"
      title={insight?.title ?? "SANDHI Research Lab"}
    />,
    size,
  );
}
