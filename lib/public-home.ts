import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import { shouldShowPublicMetrics } from "@/lib/public-metrics";
import {
  publicAreaWhere,
  publicMemberWhere,
  publicNewsWhere,
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

export type HomeData = {
  projects: HomeProject[];
  publications: HomePublication[];
  news: HomeNews[];
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

export async function getHomeData(now = new Date()): Promise<HomeData> {
  if (!isDatabaseConfigured()) return emptyHomeData;

  const db = getDb();
  const [projects, publications, news, setting, counts] = await Promise.all([
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
      where: publicNewsWhere(now),
      orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        slug: true,
        title: true,
        category: true,
        publishAt: true,
        createdAt: true,
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
    news: news.map((post) => ({
      slug: post.slug,
      title: post.title,
      category: post.category,
      date: post.publishAt ?? post.createdAt,
    })),
    metrics: {
      ...metricCounts,
      visible: shouldShowPublicMetrics(setting?.value === true, metricCounts),
    },
  };
}
