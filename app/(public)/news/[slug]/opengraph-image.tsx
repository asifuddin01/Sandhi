import { ImageResponse } from "next/og";

import { SandhiSocialCard } from "@/components/public/SandhiSocialCard";
import { getPublicNewsBySlug } from "@/lib/public-content";

export const alt = "SANDHI Research Lab news";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublicNewsBySlug(slug);

  return new ImageResponse(
    <SandhiSocialCard
      section="News"
      title={post?.title ?? "SANDHI Research Lab"}
    />,
    size,
  );
}
