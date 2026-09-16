import { ImageResponse } from "next/og";

import { SandhiSocialCard } from "@/components/public/SandhiSocialCard";
import { getPublicPublicationBySlug } from "@/lib/public-content";

export const alt = "SANDHI Research Lab publication";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const publication = await getPublicPublicationBySlug(slug);

  return new ImageResponse(
    <SandhiSocialCard
      section="Publication"
      title={publication?.title ?? "SANDHI Research Lab"}
    />,
    size,
  );
}
