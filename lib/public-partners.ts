import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { safePartnerUrl, type PartnerKind } from "@/lib/partner-content";
import { publicPartnerWhere } from "@/lib/visibility";

export interface PublicPartner {
  id: string;
  name: string;
  kind: PartnerKind;
  description: string;
  relationship: string | null;
  url: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
}

const partnerSelect = {
  id: true,
  name: true,
  kind: true,
  description: true,
  relationship: true,
  url: true,
  logoKey: true,
  logoAlt: true,
} satisfies Prisma.PartnerSelect;

function publicAssetUrl(key: string | null): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!key || !base) return null;

  try {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return new URL(encodedKey, `${base.replace(/\/$/u, "")}/`).toString();
  } catch {
    return null;
  }
}

export async function getPublicPartners(): Promise<PublicPartner[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb().partner.findMany({
    where: publicPartnerWhere,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: partnerSelect,
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    description: row.description,
    relationship: row.relationship,
    url: safePartnerUrl(row.url),
    logoUrl: publicAssetUrl(row.logoKey),
    logoAlt: row.logoAlt,
  }));
}
