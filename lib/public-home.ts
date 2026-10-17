import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import { shouldShowPublicMetrics } from "@/lib/public-metrics";
import { cachedPublicRead } from "@/lib/cache";
import { cacheTags } from "@/lib/cache-tags";
import { markdownPreview } from "@/lib/markdown-preview";
import {
  isNewsPublic,
  NEWS_PUBLISHABLE_STATES,
  publicAreaWhere,
  publicMemberWhere,
  publicProjectUpdateWhere,
  publicProjectWhere,
  publicPublicationWhere,
} from "@/lib/visibility";

export type HomeProject = {
  slug: string;
  title: string;
  gloss: string;
  status: string;
  startYear: number | null;
  areas: Array<{ slug: string; name: string }>;
  researchers: Array<{ slug: string; name: string }>;
};

export type HomePublication = {
  slug: string;
  title: string;
  venueName: string | null;
  year: number | null;
  type: string;
  authors: Array<{ name: string; slug: string | null }>;
  links: Array<{ label: string; href: string }>;
};

export type HomeNews = {
  slug: string;
  title: string;
  category: string;
  date: Date;
};

/** A published progress update from a public project, newest first. */
export type HomeUpdate = {
  id: string;
  title: string;
  /** The update's opening as plain text (see `markdownPreview`). */
  summary: string;
  postedAt: string;
  project: { slug: string; title: string };
};

/**
 * A post before the clock has been consulted. Never leaves this module, and
 * carries its times as ISO strings because the cache stores JSON — a `Date`
 * put in comes back out as a string, and the `CacheSafe` constraint on
 * `cachedPublicRead` refuses it rather than letting that surprise anyone.
 */
type HomeNewsCandidate = Omit<HomeNews, "date"> & {
  state: string;
  publishAt: string | null;
  date: string;
};

type HomeReadData = Omit<HomeData, "news"> & { news: HomeNewsCandidate[] };

export type HomeData = {
  projects: HomeProject[];
  publications: HomePublication[];
  news: HomeNews[];
  updates: HomeUpdate[];
  metrics: {
    visible: boolean;
    researchers: number;
    projects: number;
    publications: number;
    areas: number;
  };
};

const emptyHomeData: HomeData = {
  projects: [],
  publications: [],
  news: [],
  updates: [],
  metrics: {
    visible: false,
    researchers: 0,
    projects: 0,
    publications: 0,
    areas: 0,
  },
};

function publicAuthor(author: {
  externalName: string | null;
  member: {
    slug: string;
    name: string;
    isPublic: boolean;
    status: string;
  } | null;
}): { name: string; slug: string | null } | null {
  if (
    author.member?.isPublic &&
    (author.member.status === "ACTIVE" || author.member.status === "ALUMNI")
  ) {
    return { name: author.member.name, slug: author.member.slug };
  }

  return author.externalName ? { name: author.externalName, slug: null } : null;
}

/**
 * Everything the home page shows, read without consulting the clock so the
 * answer can be cached and shared.
 *
 * News is the one part that depends on the time: a scheduled post becomes
 * public when its moment passes, with nothing changing in the database. So
 * the publishable ones are read here and `getHomeData` decides which are due
 * — a cached entry would otherwise freeze whatever `now` was when it was
 * filled, and a scheduled post would stay invisible for as long as the entry
 * lived.
 */
async function readHomeData(): Promise<HomeReadData> {
  if (!isDatabaseConfigured()) return { ...emptyHomeData, news: [] };

  const db = getDb();
  const [projects, publications, news, updates, setting, counts] = await Promise.all([
    db.project.findMany({
      where: {
        ...publicProjectWhere,
        featured: true,
        status: { not: "ARCHIVED" },
      },
      orderBy: [{ startedAt: "desc" }, { title: "asc" }],
      take: 3,
      select: {
        slug: true,
        title: true,
        gloss: true,
        status: true,
        startedAt: true,
        areas: {
          where: { area: publicAreaWhere },
          select: { area: { select: { slug: true, name: true } } },
        },
        members: {
          where: { member: publicMemberWhere },
          orderBy: [{ isLead: "desc" }, { sortOrder: "asc" }],
          select: {
            member: { select: { slug: true, name: true } },
          },
        },
      },
    }),
    db.publication.findMany({
      where: publicPublicationWhere,
      orderBy: [{ publishedAt: "desc" }, { year: "desc" }, { title: "asc" }],
      take: 5,
      select: {
        slug: true,
        title: true,
        venueName: true,
        year: true,
        type: true,
        pdfUrl: true,
        codeUrl: true,
        datasetUrl: true,
        pageUrl: true,
        project: {
          select: { slug: true, state: true },
        },
        authors: {
          orderBy: { position: "asc" },
          select: {
            externalName: true,
            member: {
              select: {
                slug: true,
                name: true,
                isPublic: true,
                status: true,
              },
            },
          },
        },
      },
    }),
    db.newsPost.findMany({
      where: { state: { in: [...NEWS_PUBLISHABLE_STATES] } },
      orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
      // More than the three shown: the ones not yet due are dropped after
      // the cache, and a run of scheduled posts must not empty the section.
      take: 12,
      select: {
        slug: true,
        title: true,
        category: true,
        state: true,
        publishAt: true,
        createdAt: true,
      },
    }),
    // Both halves of the rule the project pages use: the team published the
    // update, and its project is public.
    db.projectUpdate.findMany({
      where: publicProjectUpdateWhere,
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        project: { select: { slug: true, title: true } },
      },
    }),
    db.siteSetting.findUnique({
      where: { key: "features.showNumbers" },
      select: { value: true },
    }),
    Promise.all([
      db.member.count({ where: publicMemberWhere }),
      db.project.count({
        where: { ...publicProjectWhere, status: { not: "ARCHIVED" } },
      }),
      db.publication.count({ where: publicPublicationWhere }),
      db.researchArea.count({ where: publicAreaWhere }),
    ]),
  ]);

  const [researchers, publicProjects, publicPublications, areas] = counts;
  const metricCounts = {
    researchers,
    projects: publicProjects,
    publications: publicPublications,
    areas,
  };

  return {
    projects: projects.map((project) => ({
      slug: project.slug,
      title: project.title,
      gloss: project.gloss,
      status: project.status,
      startYear: project.startedAt?.getUTCFullYear() ?? null,
      areas: project.areas.map(({ area }) => area),
      researchers: project.members.map(({ member }) => member),
    })),
    publications: publications.map((publication) => {
      const links = [
        publication.pdfUrl
          ? { label: "Paper", href: publication.pdfUrl }
          : null,
        publication.codeUrl
          ? { label: "Code", href: publication.codeUrl }
          : null,
        publication.datasetUrl
          ? { label: "Dataset", href: publication.datasetUrl }
          : null,
        publication.project?.state === "PUBLISHED"
          ? {
              label: "Project",
              href: `/projects/${publication.project.slug}`,
            }
          : null,
      ].filter(
        (link): link is { label: string; href: string } => link !== null,
      );

      return {
        slug: publication.slug,
        title: publication.title,
        venueName: publication.venueName,
        year: publication.year,
        type: publication.type,
        authors: publication.authors
          .map(publicAuthor)
          .filter(
            (author): author is { name: string; slug: string | null } =>
              author !== null,
          ),
        links,
      };
    }),
    updates: updates.map((update) => ({
      id: update.id,
      title: update.title,
      summary: markdownPreview(update.body),
      postedAt: update.createdAt.toISOString(),
      project: update.project,
    })),
    // Carried with their state and time so the clock can be applied after
    // the cache; `getHomeData` trims them to the three that are due.
    news: news.map((post) => ({
      slug: post.slug,
      title: post.title,
      category: post.category,
      state: post.state,
      publishAt: post.publishAt?.toISOString() ?? null,
      date: (post.publishAt ?? post.createdAt).toISOString(),
    })),
    metrics: {
      ...metricCounts,
      visible: shouldShowPublicMetrics(setting?.value === true, metricCounts),
    },
  };
}

const cachedHomeData = cachedPublicRead(
  "public-home",
  [
    cacheTags.projects,
    cacheTags.publications,
    cacheTags.news,
    cacheTags.members,
    cacheTags.research,
    cacheTags.settings,
  ],
  readHomeData,
);

/**
 * The home page. Everything but the clock comes from a shared cache; which
 * posts are due is decided here, per request, so a scheduled post appears the
 * moment it is due rather than whenever the cache next happens to be filled.
 */
export async function getHomeData(now = new Date()): Promise<HomeData> {
  const data = await cachedHomeData();

  return {
    ...data,
    news: data.news
      .filter((post) => isNewsPublic(post, now))
      .slice(0, 3)
      .map((post) => ({
        slug: post.slug,
        title: post.title,
        category: post.category,
        date: new Date(post.date),
      })),
  };
}
