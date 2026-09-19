import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { parsePublishState } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { PARTNER_KINDS } from "@/lib/partner-content";

export const PARTNER_PAGE_SIZE = 50;

export async function getPartnersIndex(filters: {
  query?: string;
  state?: string;
  kind?: string;
  page?: number;
}) {
  const query = filters.query?.trim().slice(0, 100) ?? "";
  const state = parsePublishState(filters.state);
  const kind = PARTNER_KINDS.find((value) => value === filters.kind);
  const page = Math.min(1000, Math.max(1, filters.page ?? 1));
  const where: Prisma.PartnerWhereInput = {
    ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    ...(state ? { state } : {}),
    ...(kind ? { kind } : {}),
  };
  const db = getDb();
  const [partners, total] = await Promise.all([
    db.partner.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * PARTNER_PAGE_SIZE,
      take: PARTNER_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        kind: true,
        state: true,
        sortOrder: true,
      },
    }),
    db.partner.count({ where }),
  ]);
  return {
    partners,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PARTNER_PAGE_SIZE)),
  };
}

export function getPartnerForEdit(id: string) {
  return getDb().partner.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      kind: true,
      description: true,
      relationship: true,
      url: true,
      logoKey: true,
      sortOrder: true,
      state: true,
    },
  });
}
