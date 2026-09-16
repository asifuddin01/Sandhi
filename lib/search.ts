import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  publicInsightWhere,
  publicMemberWhere,
  publicNewsWhere,
  publicProjectWhere,
  publicPublicationWhere,
} from "@/lib/visibility";

export type PublicSearchResult = {
  kind: "Project" | "Publication" | "Person" | "News" | "Insight";
  title: string;
  description: string;
  href: string;
};

function cleanQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").slice(0, 120);
}

export async function searchPublic(
  query: string,
  now = new Date(),
): Promise<PublicSearchResult[]> {
  const term = cleanQuery(query);
  if (term.length < 2 || !isDatabaseConfigured()) return [];

  const contains = { contains: term, mode: "insensitive" as const };
  const db = getDb();
  const [projects, publications, people, news, insights] = await Promise.all([
    db.project.findMany({
      where: {
        ...publicProjectWhere,
        OR: [{ title: contains }, { gloss: contains }, { abstract: contains }],
      },
      take: 5,
      orderBy: { title: "asc" },
      select: { slug: true, title: true, gloss: true },
    }),
    db.publication.findMany({
      where: {
        ...publicPublicationWhere,
        AND: [
          {
            OR: [
              { title: contains },
              { abstract: contains },
              { venueName: contains },
              { searchAuthors: contains },
            ],
          },
        ],
      },
      take: 5,
      orderBy: [{ year: "desc" }, { title: "asc" }],
      select: { slug: true, title: true, venueName: true, year: true },
    }),
    db.member.findMany({
      where: {
        ...publicMemberWhere,
        OR: [{ name: contains }, { bio: contains }, { title: contains }],
      },
      take: 5,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, rank: true, title: true },
    }),
    db.newsPost.findMany({
      where: {
        ...publicNewsWhere(now),
        AND: [{ OR: [{ title: contains }, { excerpt: contains }] }],
      },
      take: 5,
      orderBy: [{ publishAt: "desc" }, { title: "asc" }],
      select: { slug: true, title: true, excerpt: true },
    }),
    db.insight.findMany({
      where: {
        ...publicInsightWhere,
        OR: [{ title: contains }, { summary: contains }],
      },
      take: 5,
      orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
      select: { slug: true, title: true, summary: true },
    }),
  ]);

  return [
    ...projects.map((project) => ({
      kind: "Project" as const,
      title: project.title,
      description: project.gloss,
      href: `/projects/${project.slug}`,
    })),
    ...publications.map((publication) => ({
      kind: "Publication" as const,
      title: publication.title,
      description:
        [publication.venueName, publication.year].filter(Boolean).join(", ") ||
        "Publication",
      href: `/publications/${publication.slug}`,
    })),
    ...people.map((person) => ({
      kind: "Person" as const,
      title: person.name,
      description:
        person.title ?? person.rank.toLocaleLowerCase().replaceAll("_", " "),
      href: `/people/${person.slug}`,
    })),
    ...news.map((post) => ({
      kind: "News" as const,
      title: post.title,
      description: post.excerpt,
      href: `/news/${post.slug}`,
    })),
    ...insights.map((insight) => ({
      kind: "Insight" as const,
      title: insight.title,
      description: insight.summary,
      href: `/insights/${insight.slug}`,
    })),
  ].slice(0, 12);
}
