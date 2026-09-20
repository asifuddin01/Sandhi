import "server-only";

import { cachedPublicRead } from "@/lib/cache";
import { cacheTags } from "@/lib/cache-tags";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  publicAreaWhere,
  publicProjectWhere,
  publicPublicationWhere,
  publicResourceWhere,
} from "@/lib/visibility";

export const RESOURCE_KINDS = [
  "DATASET",
  "BENCHMARK",
  "CODE",
  "MODEL",
  "TOOL",
  "TUTORIAL",
  "REPORT",
] as const;

export type PublicResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCES_EMPTY =
  "Datasets, code, and models will be released here alongside our publications.";

export const RESOURCE_KIND_LABELS: Record<PublicResourceKind, string> = {
  DATASET: "Datasets",
  BENCHMARK: "Benchmarks",
  CODE: "Code",
  MODEL: "Models",
  TOOL: "Tools",
  TUTORIAL: "Tutorials",
  REPORT: "Technical reports",
};

export interface PublicResourceSummary {
  slug: string;
  name: string;
  kind: PublicResourceKind;
  description: string;
  license: string | null;
  version: string | null;
  areas: Array<{ slug: string; name: string }>;
}

export interface PublicResourceDetail extends PublicResourceSummary {
  downloadUrl: string | null;
  repoUrl: string | null;
  docsUrl: string | null;
  hfUrl: string | null;
  bibtex: string | null;
  changelog: string | null;
  project: { slug: string; title: string } | null;
  publication: { slug: string; title: string } | null;
}

export function safeResourceUrl(value: string | null): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const resourceSelect = {
  slug: true,
  name: true,
  kind: true,
  description: true,
  license: true,
  version: true,
  downloadUrl: true,
  repoUrl: true,
  docsUrl: true,
  hfUrl: true,
  bibtex: true,
  changelog: true,
  projectId: true,
  publicationId: true,
  areas: {
    where: { area: publicAreaWhere },
    orderBy: { area: { sortOrder: "asc" } },
    select: { area: { select: { slug: true, name: true } } },
  },
} as const;

async function readPublicResources(): Promise<PublicResourceSummary[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb().resource.findMany({
    where: publicResourceWhere,
    orderBy: { name: "asc" },
    select: resourceSelect,
  });

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    description: row.description,
    license: row.license,
    version: row.version,
    areas: row.areas.map(({ area }) => area),
  }));
}

async function loadResourceDetail(
  where: Prisma.ResourceWhereInput,
): Promise<PublicResourceDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getDb();
  const row = await db.resource.findFirst({
    where,
    select: resourceSelect,
  });
  if (!row) return null;

  const [project, publication] = await Promise.all([
    row.projectId
      ? db.project.findFirst({
          where: { AND: [publicProjectWhere, { id: row.projectId }] },
          select: { slug: true, title: true },
        })
      : null,
    row.publicationId
      ? db.publication.findFirst({
          where: {
            AND: [publicPublicationWhere, { id: row.publicationId }],
          },
          select: { slug: true, title: true },
        })
      : null,
  ]);

  return {
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    description: row.description,
    license: row.license,
    version: row.version,
    downloadUrl: safeResourceUrl(row.downloadUrl),
    repoUrl: safeResourceUrl(row.repoUrl),
    docsUrl: safeResourceUrl(row.docsUrl),
    hfUrl: safeResourceUrl(row.hfUrl),
    bibtex: row.bibtex,
    changelog: row.changelog,
    areas: row.areas.map(({ area }) => area),
    project,
    publication,
  };
}

export const getPublicResourceBySlug = cache(
  (slug: string): Promise<PublicResourceDetail | null> =>
    loadResourceDetail({ AND: [publicResourceWhere, { slug }] }),
);

/** Any resource by id, as its page would show it: admin preview only. */
export function getResourceForPreview(
  id: string,
): Promise<PublicResourceDetail | null> {
  return loadResourceDetail({ id });
}

/**
 * Cached because a resource list is the same for everybody and changes only
 * when somebody publishes one, which expires the tag.
 */
export const getPublicResources = cachedPublicRead(
  "public-resources",
  [cacheTags.resources],
  readPublicResources,
);
