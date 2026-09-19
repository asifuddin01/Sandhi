import { apiRoute } from "@/lib/api/handler";
import { PUBLIC_CACHE, requireSection } from "@/lib/api/public";
import { getPublicPartners } from "@/lib/public-partners";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute({ cache: PUBLIC_CACHE }, async () => {
  await requireSection("partners");
  return { partners: await getPublicPartners() };
});
