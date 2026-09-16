import "server-only";

import { cache } from "react";

import { researchThemes } from "@/content/strings";
import type {
  GraphEdge,
  GraphNode,
  GraphNodeKind,
  PublicGraphData,
} from "@/lib/graph-types";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  publicAreaWhere,
  publicMemberWhere,
  publicProjectWhere,
  publicPublicationWhere,
  publicThemeWhere,
} from "@/lib/visibility";

const SPARSE_ENTITY_THRESHOLD = 8;

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function nodeId(kind: GraphNodeKind, slug: string): string {
  return `${kind}:${slug}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function graphSummary(nodes: GraphNode[], edges: GraphEdge[]): string {
  const count = (kind: GraphNodeKind) =>
    nodes.filter((node) => node.kind === kind).length;
  return [
    "SANDHI research connections map.",
    `${count("theme")} themes connect to ${count("area")} research areas,`,
    `${count("project")} projects, ${count("person")} people, and`,
    `${count("publication")} publications through ${edges.length} relationships.`,
  ].join(" ");
}

function fallbackGraph(): PublicGraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const theme of researchThemes) {
    const themeSlug = slugify(theme.name);
    const themeId = nodeId("theme", themeSlug);
    nodes.push({
      id: themeId,
      kind: "theme",
      label: theme.name,
      description: theme.gloss,
      href: `/research/${themeSlug}`,
      themeSlugs: [themeSlug],
    });

    for (const areaName of theme.areas) {
      const areaSlug = slugify(areaName);
      const areaId = nodeId("area", areaSlug);
      nodes.push({
        id: areaId,
        kind: "area",
        label: areaName,
        description: `A research area within ${theme.name}.`,
        href: `/research/areas/${areaSlug}`,
        themeSlugs: [themeSlug],
      });
      edges.push({
        id: `${themeId}--${areaId}`,
        source: themeId,
        target: areaId,
        relationship: "contains",
      });
    }
  }

  return {
    nodes,
    edges,
    themes: researchThemes.map((theme) => ({
      slug: slugify(theme.name),
      name: theme.name,
    })),
    summary: graphSummary(nodes, edges),
    sparse: true,
  };
}

function addEdge(
  edges: Map<string, GraphEdge>,
  source: string,
  target: string,
  relationship: GraphEdge["relationship"],
) {
  const id = `${source}--${target}`;
  edges.set(id, { id, source, target, relationship });
}

export const getPublicGraph = cache(async (): Promise<PublicGraphData> => {
  if (!isDatabaseConfigured()) return fallbackGraph();

  const db = getDb();
  const [themes, projects, members, publications] = await Promise.all([
    db.researchTheme.findMany({
      where: publicThemeWhere,
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        gloss: true,
        areas: {
          where: publicAreaWhere,
          orderBy: { sortOrder: "asc" },
          select: { slug: true, name: true, summary: true },
        },
      },
    }),
    db.project.findMany({
      where: publicProjectWhere,
      orderBy: [{ featured: "desc" }, { startedAt: "desc" }],
      select: {
        slug: true,
        title: true,
        gloss: true,
        areas: {
          where: { area: publicAreaWhere },
          select: {
            area: {
              select: {
                slug: true,
                theme: { select: { slug: true } },
              },
            },
          },
        },
        members: {
          where: { member: publicMemberWhere },
          select: { member: { select: { slug: true } } },
        },
      },
    }),
    db.member.findMany({
      where: publicMemberWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        rank: true,
        title: true,
        areas: {
          where: { area: publicAreaWhere },
          select: {
            area: {
              select: {
                slug: true,
                theme: { select: { slug: true } },
              },
            },
          },
        },
        projects: {
          where: { project: publicProjectWhere },
          select: {
            project: {
              select: {
                slug: true,
                areas: {
                  where: { area: publicAreaWhere },
                  select: {
                    area: { select: { theme: { select: { slug: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.publication.findMany({
      where: publicPublicationWhere,
      orderBy: [{ year: "desc" }, { publishedAt: "desc" }],
      select: {
        slug: true,
        title: true,
        type: true,
        venueName: true,
        year: true,
        project: {
          select: {
            slug: true,
            state: true,
            areas: {
              where: { area: publicAreaWhere },
              select: {
                area: { select: { theme: { select: { slug: true } } } },
              },
            },
          },
        },
        areas: {
          where: { area: publicAreaWhere },
          select: {
            area: {
              select: {
                slug: true,
                theme: { select: { slug: true } },
              },
            },
          },
        },
        authors: {
          where: { member: publicMemberWhere },
          orderBy: { position: "asc" },
          select: { member: { select: { slug: true } } },
        },
      },
    }),
  ]);

  const enrichmentCount =
    projects.length + members.length + publications.length;
  const sparse = enrichmentCount < SPARSE_ENTITY_THRESHOLD;
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const theme of themes) {
    const themeId = nodeId("theme", theme.slug);
    nodes.set(themeId, {
      id: themeId,
      kind: "theme",
      label: theme.name,
      description: theme.gloss,
      href: `/research/${theme.slug}`,
      themeSlugs: [theme.slug],
    });

    for (const area of theme.areas) {
      const areaId = nodeId("area", area.slug);
      nodes.set(areaId, {
        id: areaId,
        kind: "area",
        label: area.name,
        description: area.summary,
        href: `/research/areas/${area.slug}`,
        themeSlugs: [theme.slug],
      });
      addEdge(edges, themeId, areaId, "contains");
    }
  }

  if (!sparse) {
    for (const project of projects) {
      const projectId = nodeId("project", project.slug);
      const themeSlugs = unique(
        project.areas.map(({ area }) => area.theme.slug),
      );
      nodes.set(projectId, {
        id: projectId,
        kind: "project",
        label: project.title,
        description: project.gloss,
        href: `/projects/${project.slug}`,
        themeSlugs,
      });
      for (const { area } of project.areas) {
        addEdge(edges, nodeId("area", area.slug), projectId, "studies");
      }
      for (const { member } of project.members) {
        addEdge(edges, projectId, nodeId("person", member.slug), "works-on");
      }
    }

    for (const member of members) {
      const personId = nodeId("person", member.slug);
      const themeSlugs = unique([
        ...member.areas.map(({ area }) => area.theme.slug),
        ...member.projects.flatMap(({ project }) =>
          project.areas.map(({ area }) => area.theme.slug),
        ),
      ]);
      nodes.set(personId, {
        id: personId,
        kind: "person",
        label: member.name,
        description:
          member.title ??
          member.rank.toLocaleLowerCase("en").replaceAll("_", " "),
        href: `/people/${member.slug}`,
        themeSlugs,
      });
      for (const { area } of member.areas) {
        addEdge(edges, nodeId("area", area.slug), personId, "researches");
      }
    }

    for (const publication of publications) {
      const publicationId = nodeId("publication", publication.slug);
      const projectIsPublic = publication.project?.state === "PUBLISHED";
      const themeSlugs = unique([
        ...publication.areas.map(({ area }) => area.theme.slug),
        ...(projectIsPublic
          ? (publication.project?.areas.map(({ area }) => area.theme.slug) ??
            [])
          : []),
      ]);
      const publicationDescription = [
        publication.venueName,
        publication.year,
        publication.type.toLocaleLowerCase("en").replaceAll("_", " "),
      ]
        .filter(Boolean)
        .join(", ");
      nodes.set(publicationId, {
        id: publicationId,
        kind: "publication",
        label: publication.title,
        description: publicationDescription,
        href: `/publications/${publication.slug}`,
        themeSlugs,
      });
      for (const { area } of publication.areas) {
        addEdge(edges, nodeId("area", area.slug), publicationId, "produced");
      }
      if (projectIsPublic && publication.project) {
        addEdge(
          edges,
          nodeId("project", publication.project.slug),
          publicationId,
          "produced",
        );
      }
      for (const { member } of publication.authors) {
        if (member) {
          addEdge(
            edges,
            nodeId("person", member.slug),
            publicationId,
            "authored",
          );
        }
      }
    }
  }

  const nodeList = [...nodes.values()];
  const validNodeIds = new Set(nodeList.map((node) => node.id));
  const edgeList = [...edges.values()].filter(
    (edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target),
  );

  return {
    nodes: nodeList,
    edges: edgeList,
    themes: themes.map((theme) => ({ slug: theme.slug, name: theme.name })),
    summary: graphSummary(nodeList, edgeList),
    sparse,
  };
});
