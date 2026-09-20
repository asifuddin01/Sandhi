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

/**
 * How many matches each kind offers up before visibility is applied. The
 * index ranks; `lib/visibility.ts` decides what may be seen; five survive.
 * The window is wide enough that a page of unpublished drafts cannot crowd
 * out the published work behind them.
 */
const CANDIDATES = 40;
const PER_KIND = 5;

/**
 * Turns what somebody typed into a tsquery, safely.
 *
 * Every token is reduced to letters and digits, so nothing the person types
 * can be read as tsquery syntax — and the last token carries `:*`, because a
 * search box is used while still typing and "neur" has to find "neural".
 * Full-text search matches whole lexemes; without the prefix it would find
 * nothing until the word was finished.
 */
export function toTsQuery(term: string): string | null {
  const tokens = term
    .toLowerCase()
    // Marks as well as letters: in Bengali the virama and the vowel signs
    // are combining marks, so without `\p{M}` "সন্ধি" is torn into pieces and
    // the lab's own name stops finding anything.
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return null;
  return tokens
    .map((token, index) =>
      index === tokens.length - 1 ? `${token}:*` : token,
    )
    .join(" & ");
}

/** Puts rows back into the order the index ranked their ids. */
function inRankOrder<T extends { id: string }>(
  rows: T[],
  ranked: string[],
): T[] {
  const place = new Map(ranked.map((id, index) => [id, index]));
  return [...rows].sort(
    (left, right) =>
      (place.get(left.id) ?? Infinity) - (place.get(right.id) ?? Infinity),
  );
}

/**
 * Public search, over the `tsvector` columns the database maintains by
 * trigger and indexes with GIN. It runs in two steps on purpose: the index
 * says what matches and how well, and Prisma then reads those rows through
 * the same `publicXWhere` clauses every other public query uses.
 *
 * Expressing visibility in the SQL would be faster still and would put a
 * second copy of the rules somewhere they could drift from
 * `lib/visibility.ts`. One source of truth is worth a round trip.
 */
export async function searchPublic(
  query: string,
  now = new Date(),
): Promise<PublicSearchResult[]> {
  const term = cleanQuery(query);
  const tsq = toTsQuery(term);
  if (term.length < 2 || !tsq || !isDatabaseConfigured()) return [];

  const db = getDb();
  const [
    projectIds,
    publicationIds,
    memberIds,
    newsIds,
    insightIds,
  ] = await Promise.all([
    db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Project"
      WHERE "search_vector" @@ to_tsquery('english', ${tsq})
      ORDER BY ts_rank_cd("search_vector", to_tsquery('english', ${tsq})) DESC
      LIMIT ${CANDIDATES}`,
    db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Publication"
      WHERE "search_vector" @@ to_tsquery('english', ${tsq})
      ORDER BY ts_rank_cd("search_vector", to_tsquery('english', ${tsq})) DESC
      LIMIT ${CANDIDATES}`,
    db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Member"
      WHERE "search_vector" @@ to_tsquery('english', ${tsq})
      ORDER BY ts_rank_cd("search_vector", to_tsquery('english', ${tsq})) DESC
      LIMIT ${CANDIDATES}`,
    db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "NewsPost"
      WHERE "search_vector" @@ to_tsquery('english', ${tsq})
      ORDER BY ts_rank_cd("search_vector", to_tsquery('english', ${tsq})) DESC
      LIMIT ${CANDIDATES}`,
    db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Insight"
      WHERE "search_vector" @@ to_tsquery('english', ${tsq})
      ORDER BY ts_rank_cd("search_vector", to_tsquery('english', ${tsq})) DESC
      LIMIT ${CANDIDATES}`,
  ]);

  const ids = {
    projects: projectIds.map((row) => row.id),
    publications: publicationIds.map((row) => row.id),
    members: memberIds.map((row) => row.id),
    news: newsIds.map((row) => row.id),
    insights: insightIds.map((row) => row.id),
  };

  const [projects, publications, people, news, insights] = await Promise.all([
    ids.projects.length === 0
      ? []
      : db.project.findMany({
          where: { ...publicProjectWhere, id: { in: ids.projects } },
          select: { id: true, slug: true, title: true, gloss: true },
        }),
    ids.publications.length === 0
      ? []
      : db.publication.findMany({
          where: {
            ...publicPublicationWhere,
            id: { in: ids.publications },
          },
          select: {
            id: true,
            slug: true,
            title: true,
            venueName: true,
            year: true,
          },
        }),
    ids.members.length === 0
      ? []
      : db.member.findMany({
          where: { ...publicMemberWhere, id: { in: ids.members } },
          select: {
            id: true,
            slug: true,
            name: true,
            rank: true,
            title: true,
          },
        }),
    ids.news.length === 0
      ? []
      : db.newsPost.findMany({
          where: { ...publicNewsWhere(now), id: { in: ids.news } },
          select: { id: true, slug: true, title: true, excerpt: true },
        }),
    ids.insights.length === 0
      ? []
      : db.insight.findMany({
          where: { ...publicInsightWhere, id: { in: ids.insights } },
          select: { id: true, slug: true, title: true, summary: true },
        }),
  ]);

  return [
    ...inRankOrder(projects, ids.projects)
      .slice(0, PER_KIND)
      .map((project) => ({
        kind: "Project" as const,
        title: project.title,
        description: project.gloss,
        href: `/projects/${project.slug}`,
      })),
    ...inRankOrder(publications, ids.publications)
      .slice(0, PER_KIND)
      .map((publication) => ({
        kind: "Publication" as const,
        title: publication.title,
        description:
          [publication.venueName, publication.year]
            .filter(Boolean)
            .join(", ") || "Publication",
        href: `/publications/${publication.slug}`,
      })),
    ...inRankOrder(people, ids.members)
      .slice(0, PER_KIND)
      .map((person) => ({
        kind: "Person" as const,
        title: person.name,
        description:
          person.title ?? person.rank.toLocaleLowerCase().replaceAll("_", " "),
        href: `/people/${person.slug}`,
      })),
    ...inRankOrder(news, ids.news)
      .slice(0, PER_KIND)
      .map((post) => ({
        kind: "News" as const,
        title: post.title,
        description: post.excerpt,
        href: `/news/${post.slug}`,
      })),
    ...inRankOrder(insights, ids.insights)
      .slice(0, PER_KIND)
      .map((insight) => ({
        kind: "Insight" as const,
        title: insight.title,
        description: insight.summary,
        href: `/insights/${insight.slug}`,
      })),
  ].slice(0, 12);
}
