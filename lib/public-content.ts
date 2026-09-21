import "server-only";

import { cachedPublicRead } from "@/lib/cache";
import { cacheTags } from "@/lib/cache-tags";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { PUBLICATION_TYPES, type PublicationType } from "@/lib/bibtex";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  publicAreaWhere,
  publicEventWhere,
  publicInsightWhere,
  publicMemberWhere,
  publicNewsWhere,
  publicOpportunityWhere,
  publicProjectWhere,
  publicPublicationWhere,
  publicResourceWhere,
  publicThemeWhere,
} from "@/lib/visibility";

export const NEWS_CATEGORIES = [
  "RESEARCH",
  "PUBLICATIONS",
  "EVENTS",
  "TEAM",
  "ANNOUNCEMENTS",
  "OPPORTUNITIES",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export interface PublicationFilters {
  q?: string;
  year?: string;
  type?: string;
  theme?: string;
  area?: string;
  researcher?: string;
  venue?: string;
  sort?: "newest" | "title";
}

export interface PublicPublicationAuthor {
  name: string;
  affiliation: string | null;
  equalContribution: boolean;
  corresponding: boolean;
  member: { name: string; slug: string } | null;
}

export interface PublicPublicationSummary {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  type: PublicationType;
  stage: string;
  venueName: string | null;
  venueShort: string | null;
  year: number | null;
  publishedAt: Date | null;
  doi: string | null;
  arxivId: string | null;
  pdfUrl: string | null;
  codeUrl: string | null;
  datasetUrl: string | null;
  pageUrl: string | null;
  bibtexOverride: string | null;
  award: string | null;
  authors: PublicPublicationAuthor[];
  areas: Array<{
    slug: string;
    name: string;
    theme: { slug: string; name: string };
  }>;
  project: { slug: string; title: string } | null;
  updatedAt: Date;
}

export interface PublicationFacets {
  years: number[];
  types: PublicationType[];
  themes: Array<{ slug: string; name: string }>;
  areas: Array<{ slug: string; name: string }>;
  researchers: Array<{ slug: string; name: string }>;
  venues: string[];
}

export interface PublicationIndexData {
  publications: PublicPublicationSummary[];
  facets: PublicationFacets;
}

export interface PublicPublicationDetail extends PublicPublicationSummary {
  resources: Array<{
    slug: string;
    name: string;
    kind: string;
  }>;
  relatedPublications: Array<{
    slug: string;
    title: string;
    type: PublicationType;
    year: number | null;
  }>;
}

export interface PublicNewsSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: NewsCategory;
  publishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicNewsDetail extends PublicNewsSummary {
  body: string;
  coverUrl: string | null;
  coverAlt: string | null;
  author: { slug: string; name: string } | null;
  project: { slug: string; title: string } | null;
  publication: { slug: string; title: string } | null;
}

export interface PublicSitemapEntry {
  path: string;
  updatedAt: Date;
}

export interface PublicFeedItem {
  kind: "news" | "insight";
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: Date;
  updatedAt: Date;
}

const publicAuthorWhere = {
  OR: [
    { member: publicMemberWhere },
    { memberId: null, externalName: { not: null } },
  ],
} satisfies Prisma.PublicationAuthorWhereInput;

const publicationSelect = {
  id: true,
  slug: true,
  title: true,
  abstract: true,
  type: true,
  stage: true,
  venueName: true,
  venueShort: true,
  year: true,
  publishedAt: true,
  doi: true,
  arxivId: true,
  pdfUrl: true,
  codeUrl: true,
  datasetUrl: true,
  pageUrl: true,
  bibtexOverride: true,
  award: true,
  projectId: true,
  updatedAt: true,
  authors: {
    where: publicAuthorWhere,
    orderBy: { position: "asc" },
    select: {
      externalName: true,
      externalAffiliation: true,
      equalContribution: true,
      corresponding: true,
      member: { select: { name: true, slug: true } },
    },
  },
  areas: {
    where: { area: publicAreaWhere },
    orderBy: { area: { sortOrder: "asc" } },
    select: {
      area: {
        select: {
          slug: true,
          name: true,
          theme: { select: { slug: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.PublicationSelect;

type PublicationRow = Prisma.PublicationGetPayload<{
  select: typeof publicationSelect;
}>;

function cleanFilter(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 160) : undefined;
}

function publicationWhere(filters: PublicationFilters) {
  const conditions: Prisma.PublicationWhereInput[] = [publicPublicationWhere];
  const q = cleanFilter(filters.q);
  const year = Number.parseInt(filters.year ?? "", 10);
  const type = PUBLICATION_TYPES.find(
    (candidate) => candidate === filters.type,
  );
  const theme = cleanFilter(filters.theme);
  const area = cleanFilter(filters.area);
  const researcher = cleanFilter(filters.researcher);
  const venue = cleanFilter(filters.venue);

  if (q) {
    conditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { venueName: { contains: q, mode: "insensitive" } },
        {
          authors: {
            some: {
              OR: [
                { externalName: { contains: q, mode: "insensitive" } },
                {
                  member: {
                    AND: [
                      publicMemberWhere,
                      { name: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }

  if (Number.isInteger(year) && year >= 1900 && year <= 2200) {
    conditions.push({ year });
  }

  if (type) conditions.push({ type });
  if (venue) conditions.push({ venueName: venue });

  if (theme) {
    conditions.push({
      areas: {
        some: {
          area: {
            AND: [
              publicAreaWhere,
              { theme: { AND: [publicThemeWhere, { slug: theme }] } },
            ],
          },
        },
      },
    });
  }

  if (area) {
    conditions.push({
      areas: { some: { area: { AND: [publicAreaWhere, { slug: area }] } } },
    });
  }

  if (researcher) {
    conditions.push({
      authors: {
        some: {
          member: { AND: [publicMemberWhere, { slug: researcher }] },
        },
      },
    });
  }

  return { AND: conditions } satisfies Prisma.PublicationWhereInput;
}

function publicationOrder(sort: PublicationFilters["sort"]) {
  return sort === "title"
    ? ([
        { title: "asc" },
      ] satisfies Prisma.PublicationOrderByWithRelationInput[])
    : ([
        { year: { sort: "desc", nulls: "last" } },
        { publishedAt: { sort: "desc", nulls: "last" } },
        { title: "asc" },
      ] satisfies Prisma.PublicationOrderByWithRelationInput[]);
}

function mapPublication(
  row: PublicationRow,
  projectById: ReadonlyMap<string, { slug: string; title: string }>,
): PublicPublicationSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    abstract: row.abstract,
    type: row.type,
    stage: row.stage,
    venueName: row.venueName,
    venueShort: row.venueShort,
    year: row.year,
    publishedAt: row.publishedAt,
    doi: row.doi,
    arxivId: row.arxivId,
    pdfUrl: row.pdfUrl,
    codeUrl: row.codeUrl,
    datasetUrl: row.datasetUrl,
    pageUrl: row.pageUrl,
    bibtexOverride: row.bibtexOverride,
    award: row.award,
    authors: row.authors.flatMap((author) => {
      const name = author.member?.name ?? author.externalName?.trim();
      if (!name) return [];

      return [
        {
          name,
          affiliation: author.externalAffiliation,
          equalContribution: author.equalContribution,
          corresponding: author.corresponding,
          member: author.member,
        },
      ];
    }),
    areas: row.areas.map(({ area: item }) => item),
    project: row.projectId ? (projectById.get(row.projectId) ?? null) : null,
    updatedAt: row.updatedAt,
  };
}

async function publicProjectMap(projectIds: Array<string | null>) {
  const ids = Array.from(
    new Set(projectIds.filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0)
    return new Map<string, { slug: string; title: string }>();

  const projects = await getDb().project.findMany({
    where: { AND: [publicProjectWhere, { id: { in: ids } }] },
    select: { id: true, slug: true, title: true },
  });

  return new Map(projects.map(({ id, slug, title }) => [id, { slug, title }]));
}

function emptyPublicationIndex(): PublicationIndexData {
  return {
    publications: [],
    facets: {
      years: [],
      types: [],
      themes: [],
      areas: [],
      researchers: [],
      venues: [],
    },
  };
}

async function read_getPublications(
  filters: PublicationFilters = {},
): Promise<PublicationIndexData> {
  if (!isDatabaseConfigured()) return emptyPublicationIndex();

  const db = getDb();
  const [rows, facetRows] = await Promise.all([
    db.publication.findMany({
      where: publicationWhere(filters),
      orderBy: publicationOrder(filters.sort),
      select: publicationSelect,
    }),
    db.publication.findMany({
      where: publicPublicationWhere,
      select: {
        year: true,
        type: true,
        venueName: true,
        authors: {
          where: publicAuthorWhere,
          select: { member: { select: { slug: true, name: true } } },
        },
        areas: {
          where: { area: publicAreaWhere },
          select: {
            area: {
              select: {
                slug: true,
                name: true,
                theme: { select: { slug: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const projectById = await publicProjectMap(rows.map((row) => row.projectId));
  const themes = new Map<string, string>();
  const areas = new Map<string, string>();
  const researchers = new Map<string, string>();

  for (const row of facetRows) {
    for (const { area } of row.areas) {
      areas.set(area.slug, area.name);
      themes.set(area.theme.slug, area.theme.name);
    }
    for (const { member } of row.authors) {
      if (member) researchers.set(member.slug, member.name);
    }
  }

  return {
    publications: rows.map((row) => mapPublication(row, projectById)),
    facets: {
      years: Array.from(
        new Set(
          facetRows
            .map(({ year: publicationYear }) => publicationYear)
            .filter((value): value is number => value !== null),
        ),
      ).sort((left, right) => right - left),
      types: Array.from(
        new Set(facetRows.map(({ type: value }) => value)),
      ).sort(),
      themes: Array.from(themes, ([slug, name]) => ({ slug, name })).sort(
        (left, right) => left.name.localeCompare(right.name),
      ),
      areas: Array.from(areas, ([slug, name]) => ({ slug, name })).sort(
        (left, right) => left.name.localeCompare(right.name),
      ),
      researchers: Array.from(researchers, ([slug, name]) => ({
        slug,
        name,
      })).sort((left, right) => left.name.localeCompare(right.name)),
      venues: Array.from(
        new Set(
          facetRows
            .map(({ venueName }) => venueName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    },
  };
}

/**
 * A publication as its public page shows it. Related projects, resources,
 * and publications appear only when public, so an admin preview is exact.
 */
async function loadPublicationDetail(
  where: Prisma.PublicationWhereInput,
): Promise<PublicPublicationDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getDb();
  const row = await db.publication.findFirst({
    where,
    select: publicationSelect,
  });
  if (!row) return null;

  const projectById = await publicProjectMap([row.projectId]);
  const project = row.projectId
    ? (projectById.get(row.projectId) ?? null)
    : null;
  const [resources, relatedPublications] = await Promise.all([
    db.resource.findMany({
      where: {
        AND: [publicResourceWhere, { publicationId: row.id }],
      },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, kind: true },
    }),
    project
      ? db.publication.findMany({
          where: {
            AND: [
              publicPublicationWhere,
              { projectId: row.projectId, id: { not: row.id } },
            ],
          },
          orderBy: publicationOrder("newest"),
          select: { slug: true, title: true, type: true, year: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    ...mapPublication(row, projectById),
    resources,
    relatedPublications,
  };
}

export const getPublicPublicationBySlug = cache(
  (slug: string): Promise<PublicPublicationDetail | null> =>
    loadPublicationDetail({ AND: [publicPublicationWhere, { slug }] }),
);

/** Any publication by id, as its page would show it: admin preview only. */
export function getPublicationForPreview(
  id: string,
): Promise<PublicPublicationDetail | null> {
  return loadPublicationDetail({ id });
}

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

export async function getPublicNews(
  category?: string,
): Promise<PublicNewsSummary[]> {
  if (!isDatabaseConfigured()) return [];
  const selectedCategory = NEWS_CATEGORIES.find((item) => item === category);

  return getDb().newsPost.findMany({
    where: {
      AND: [
        publicNewsWhere(),
        ...(selectedCategory ? [{ category: selectedCategory }] : []),
      ],
    },
    orderBy: [
      { publishAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      category: true,
      publishAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * A news post as its public page shows it. Related people, projects, and
 * publications appear only when they are public themselves, so an admin
 * preview of a draft shows exactly what readers will see.
 */
async function loadNewsDetail(
  where: Prisma.NewsPostWhereInput,
): Promise<PublicNewsDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getDb();
  const row = await db.newsPost.findFirst({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      category: true,
      coverKey: true,
      coverAlt: true,
      publishAt: true,
      authorId: true,
      projectId: true,
      publicationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return null;

  const [author, project, publication] = await Promise.all([
    row.authorId
      ? db.member.findFirst({
          where: { AND: [publicMemberWhere, { id: row.authorId }] },
          select: { slug: true, name: true },
        })
      : null,
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
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    category: row.category,
    coverUrl: publicAssetUrl(row.coverKey),
    coverAlt: row.coverAlt,
    publishAt: row.publishAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author,
    project,
    publication,
  };
}

export const getPublicNewsBySlug = cache(
  (slug: string): Promise<PublicNewsDetail | null> =>
    loadNewsDetail({ AND: [publicNewsWhere(), { slug }] }),
);

/** Any news post by id, visible or not: for the admin preview only. */
export function getNewsDetailForPreview(
  id: string,
): Promise<PublicNewsDetail | null> {
  return loadNewsDetail({ id });
}

export async function getPublicSitemapEntries(): Promise<PublicSitemapEntry[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getDb();
  const [
    themes,
    areas,
    projects,
    publications,
    members,
    news,
    events,
    opportunities,
    resources,
    insights,
  ] = await Promise.all([
    db.researchTheme.findMany({
      where: publicThemeWhere,
      select: { slug: true, updatedAt: true },
    }),
    db.researchArea.findMany({
      where: publicAreaWhere,
      select: { slug: true, updatedAt: true },
    }),
    db.project.findMany({
      where: publicProjectWhere,
      select: { slug: true, updatedAt: true },
    }),
    db.publication.findMany({
      where: publicPublicationWhere,
      select: { slug: true, updatedAt: true },
    }),
    db.member.findMany({
      where: publicMemberWhere,
      select: { slug: true, updatedAt: true },
    }),
    db.newsPost.findMany({
      where: publicNewsWhere(),
      select: { slug: true, updatedAt: true },
    }),
    db.event.findMany({
      where: publicEventWhere(),
      select: { slug: true, updatedAt: true },
    }),
    db.opportunity.findMany({
      where: publicOpportunityWhere(),
      select: { slug: true, updatedAt: true },
    }),
    db.resource.findMany({
      where: publicResourceWhere,
      select: { slug: true, updatedAt: true },
    }),
    db.insight.findMany({
      where: publicInsightWhere,
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    ...themes.map((item) => ({
      path: `/research/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...areas.map((item) => ({
      path: `/research/areas/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...projects.map((item) => ({
      path: `/projects/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...publications.map((item) => ({
      path: `/publications/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...members.map((item) => ({
      path: `/people/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...news.map((item) => ({
      path: `/news/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...events.map((item) => ({
      path: `/events/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...opportunities.map((item) => ({
      path: `/opportunities/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...resources.map((item) => ({
      path: `/resources/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...insights.map((item) => ({
      path: `/insights/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
  ];
}

export async function getPublicFeedItems(): Promise<PublicFeedItem[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getDb();
  const [news, insights] = await Promise.all([
    db.newsPost.findMany({
      where: publicNewsWhere(),
      take: 50,
      orderBy: [
        { publishAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      select: {
        slug: true,
        title: true,
        excerpt: true,
        category: true,
        publishAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.insight.findMany({
      where: publicInsightWhere,
      take: 50,
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      select: {
        slug: true,
        title: true,
        summary: true,
        kind: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return [
    ...news.map((item): PublicFeedItem => ({
      kind: "news",
      slug: item.slug,
      title: item.title,
      description: item.excerpt,
      category: item.category,
      publishedAt: item.publishAt ?? item.createdAt,
      updatedAt: item.updatedAt,
    })),
    ...insights.map((item): PublicFeedItem => ({
      kind: "insight",
      slug: item.slug,
      title: item.title,
      description: item.summary,
      category: item.kind,
      publishedAt: item.publishedAt ?? item.createdAt,
      updatedAt: item.updatedAt,
    })),
  ]
    .sort(
      (left, right) => right.publishedAt.getTime() - left.publishedAt.getTime(),
    )
    .slice(0, 50);
}

async function read_getLegalSettings(): Promise<{
  applicationRetentionMonths: number;
  contactEmail: string;
}> {
  const defaults = {
    applicationRetentionMonths: 24,
    contactEmail: "contact@sandhiresearch.org",
  };
  if (!isDatabaseConfigured()) return defaults;

  const settings = await getDb().siteSetting.findMany({
    where: {
      key: { in: ["applications.retentionMonths", "contact.general"] },
    },
    select: { key: true, value: true },
  });
  const byKey = new Map(settings.map(({ key, value }) => [key, value]));
  const retentionValue = byKey.get("applications.retentionMonths");
  const contactValue = byKey.get("contact.general");
  const retention =
    typeof retentionValue === "number" &&
    Number.isInteger(retentionValue) &&
    retentionValue > 0
      ? retentionValue
      : defaults.applicationRetentionMonths;

  return {
    applicationRetentionMonths: retention,
    contactEmail:
      typeof contactValue === "string" && contactValue.includes("@")
        ? contactValue
        : defaults.contactEmail,
  };
}

export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c");
}

/**
 * The cache stores JSON, so a `Date` put in comes back a string. The two
 * dated fields cross it as ISO strings and are turned back on the way out;
 * the `CacheSafe` constraint on `cachedPublicRead` is what refuses the
 * alternative, and the return type here is what stops one being converted on
 * the way in and forgotten on the way out.
 */
type CachedPublication = Omit<
  PublicPublicationSummary,
  "publishedAt" | "updatedAt"
> & { publishedAt: string | null; updatedAt: string };

const cachedPublications = cachedPublicRead(
  "public-publications",
  [cacheTags.publications, cacheTags.members],
  async (
    filters: PublicationFilters = {},
  ): Promise<
    Omit<PublicationIndexData, "publications"> & {
      publications: CachedPublication[];
    }
  > => {
    const data = await read_getPublications(filters);
    return {
      ...data,
      publications: data.publications.map((publication) => ({
        ...publication,
        publishedAt: publication.publishedAt?.toISOString() ?? null,
        updatedAt: publication.updatedAt.toISOString(),
      })),
    };
  },
);

export async function getPublications(
  filters: PublicationFilters = {},
): Promise<PublicationIndexData> {
  const data = await cachedPublications(filters);
  return {
    ...data,
    publications: data.publications.map((publication) => ({
      ...publication,
      publishedAt: publication.publishedAt
        ? new Date(publication.publishedAt)
        : null,
      updatedAt: new Date(publication.updatedAt),
    })),
  };
}

/**
 * Cached: the same list for everybody, changing only when somebody publishes,
 * which expires the tag.
 */
export const getLegalSettings = cachedPublicRead(
  "public-legal-settings",
  [cacheTags.settings],
  read_getLegalSettings,
);
