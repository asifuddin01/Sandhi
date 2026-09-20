import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import type { ProjectStatusValue } from "@/lib/project-status";
import {
  publicAreaWhere,
  publicInsightWhere,
  publicMemberWhere,
  PUBLIC_MEMBER_STATUSES,
  publicProjectResearch,
  publicProjectSectionWhere,
  publicProjectUpdateWhere,
  publicProjectWhere,
  publicPublicationWhere,
  publicResourceWhere,
  publicThemeWhere,
} from "@/lib/visibility";

export {
  isProjectStatus,
  PROJECT_STATUSES,
  type ProjectStatusValue,
} from "@/lib/project-status";

/** How many published updates a project page carries; the rest are history. */
const PUBLIC_UPDATES = 20;

export interface AreaLink {
  slug: string;
  name: string;
  theme: { slug: string; name: string };
}

export interface PersonSummary {
  slug: string;
  name: string;
  rank: string;
  status: string;
  title: string | null;
  interests: string[];
  photoUrl: string | null;
  photoAlt: string;
  areas: Array<{ slug: string; name: string }>;
}

export interface ProjectSummary {
  slug: string;
  title: string;
  gloss: string;
  status: ProjectStatusValue;
  /** The finer step inside a running project, when the team has set one. */
  phase: string | null;
  startedAt: string | null;
  areas: AreaLink[];
  members: Array<{
    slug: string;
    name: string;
    role: string;
    isLead: boolean;
  }>;
}

export interface PublicationSummary {
  slug: string;
  title: string;
  type: string;
  venueName: string | null;
  venueShort: string | null;
  year: number | null;
  authors: Array<{
    name: string;
    memberSlug: string | null;
  }>;
}

export interface ResearchIndexData {
  themes: Array<{
    slug: string;
    name: string;
    gloss: string;
    areas: Array<{ slug: string; name: string; summary: string }>;
    projectCount: number;
    publicationCount: number;
  }>;
}

export interface ThemeDetailData {
  slug: string;
  name: string;
  gloss: string;
  overview: string | null;
  areas: Array<{
    slug: string;
    name: string;
    summary: string;
    overview: string | null;
  }>;
  projects: ProjectSummary[];
  publications: PublicationSummary[];
}

export interface AreaDetailData {
  slug: string;
  name: string;
  summary: string;
  overview: string | null;
  questions: string[];
  theme: { slug: string; name: string; gloss: string };
  projects: ProjectSummary[];
  publications: PublicationSummary[];
  researchers: PersonSummary[];
  resources: Array<{
    slug: string;
    name: string;
    kind: string;
    description: string;
  }>;
  relatedAreas: Array<{ slug: string; name: string }>;
}

export interface ProjectFilters {
  status?: ProjectStatusValue;
  theme?: string;
  area?: string;
  researcher?: string;
}

export interface ProjectsIndexData {
  projects: ProjectSummary[];
  options: {
    themes: Array<{ slug: string; name: string }>;
    areas: Array<{ slug: string; name: string }>;
    researchers: Array<{ slug: string; name: string }>;
  };
}

/**
 * A standing part of a project's account of itself, published by the team:
 * methodology, datasets, architecture. Ordered as the team arranged it.
 */
export interface ProjectSectionEntry {
  id: string;
  title: string;
  body: string;
  attachments: ProjectUpdateFile[];
}

/** One published progress update, as the project's public page shows it. */
export interface ProjectUpdateEntry {
  id: string;
  title: string;
  body: string;
  nextUp: string | null;
  /** The stage the project was at when this was written, not where it is now. */
  stage: ProjectStatusValue;
  phase: string | null;
  author: { name: string; memberSlug: string | null } | null;
  postedAt: string;
  attachments: ProjectUpdateFile[];
}

/** A file published with an update: a figure, a document, or a data file. */
export interface ProjectUpdateFile {
  id: string;
  kind: "FIGURE" | "DOCUMENT" | "DATA";
  title: string;
  contentType: string;
  byteSize: number;
}

export interface ProjectDetailData extends ProjectSummary {
  abstract: string;
  question: string;
  motivation: string | null;
  approach: string | null;
  experiments: string | null;
  results: string | null;
  resultsPublic: boolean;
  endedAt: string | null;
  links: Array<{ label: string; href: string }>;
  publications: PublicationSummary[];
  relatedProjects: Array<{ slug: string; title: string; gloss: string }>;
  sections: ProjectSectionEntry[];
  updates: ProjectUpdateEntry[];
}

export interface PeopleIndexData {
  people: PersonSummary[];
  areas: Array<{ slug: string; name: string }>;
}

export interface PersonDetailData extends PersonSummary {
  bio: string | null;
  orgEmail: string | null;
  links: Array<{ label: string; href: string }>;
  projects: ProjectSummary[];
  publications: PublicationSummary[];
  notes: Array<{
    slug: string;
    title: string;
    summary: string;
    publishedAt: string | null;
  }>;
}

export interface AboutData {
  milestones: Array<{
    id: string;
    date: string;
    title: string;
    body: string | null;
  }>;
  leadership: PersonSummary[];
}

const memberSummarySelect = {
  slug: true,
  name: true,
  rank: true,
  status: true,
  title: true,
  interests: true,
  photoKey: true,
  photoAlt: true,
  areas: {
    where: { area: publicAreaWhere },
    orderBy: { area: { sortOrder: "asc" } },
    select: { area: { select: { slug: true, name: true } } },
  },
} satisfies Prisma.MemberSelect;

const projectSummarySelect = {
  slug: true,
  title: true,
  gloss: true,
  status: true,
  phase: true,
  startedAt: true,
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
  members: {
    where: { member: publicMemberWhere },
    orderBy: [{ isLead: "desc" }, { sortOrder: "asc" }],
    select: {
      role: true,
      isLead: true,
      member: { select: { slug: true, name: true } },
    },
  },
} satisfies Prisma.ProjectSelect;

const attachmentSelect = {
  id: true,
  kind: true,
  title: true,
  contentType: true,
  byteSize: true,
} satisfies Prisma.AttachmentSelect;

const projectSectionSelect = {
  id: true,
  title: true,
  body: true,
  attachments: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: attachmentSelect,
  },
} satisfies Prisma.ProjectSectionSelect;

const projectUpdateSelect = {
  id: true,
  title: true,
  body: true,
  nextUp: true,
  stage: true,
  phase: true,
  createdAt: true,
  author: { select: { slug: true, name: true, isPublic: true, status: true } },
  attachments: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: attachmentSelect,
  },
} satisfies Prisma.ProjectUpdateSelect;

const publicationSummarySelect = {
  slug: true,
  title: true,
  type: true,
  venueName: true,
  venueShort: true,
  year: true,
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
} satisfies Prisma.PublicationSelect;

type ProjectSummaryRecord = Prisma.ProjectGetPayload<{
  select: typeof projectSummarySelect;
}>;
type PublicationSummaryRecord = Prisma.PublicationGetPayload<{
  select: typeof publicationSummarySelect;
}>;
type ProjectUpdateRecord = Prisma.ProjectUpdateGetPayload<{
  select: typeof projectUpdateSelect;
}>;
type ProjectSectionRecord = Prisma.ProjectSectionGetPayload<{
  select: typeof projectSectionSelect;
}>;

function mapAttachments(
  files: ProjectUpdateRecord["attachments"],
): ProjectUpdateFile[] {
  return files.map((file) => ({
    id: file.id,
    kind: file.kind as ProjectUpdateFile["kind"],
    title: file.title,
    contentType: file.contentType,
    byteSize: file.byteSize,
  }));
}

function mapProjectSection(record: ProjectSectionRecord): ProjectSectionEntry {
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    attachments: mapAttachments(record.attachments),
  };
}
type MemberSummaryRecord = Prisma.MemberGetPayload<{
  select: typeof memberSummarySelect;
}>;

async function queryPublic<T>(
  fallback: T,
  query: () => Promise<T>,
): Promise<T> {
  if (!isDatabaseConfigured()) return fallback;
  return query();
}

/**
 * Where a stored image is served from. With a public bucket configured, from
 * there. Without one, from the site itself under `/media`, which is the same
 * origin the CSP already allows and works on whatever port this is — so a
 * lab that has not set up object storage yet still has pictures.
 */
function mediaUrl(key: string | null): string | null {
  if (!key) return null;
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) {
    const encoded = key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `/media/${encoded}`;
  }

  try {
    const normalizedBase = new URL(base);
    if (!["http:", "https:"].includes(normalizedBase.protocol)) return null;
    const encodedKey = key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return new URL(
      encodedKey,
      `${normalizedBase.toString().replace(/\/$/, "")}/`,
    ).toString();
  } catch {
    return null;
  }
}

function externalUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapMember(record: MemberSummaryRecord): PersonSummary {
  return {
    slug: record.slug,
    name: record.name,
    rank: record.rank,
    status: record.status,
    title: record.title,
    interests: record.interests,
    photoUrl: mediaUrl(record.photoKey),
    photoAlt: record.photoAlt?.trim() || `${record.name}, SANDHI researcher`,
    areas: record.areas.map(({ area }) => area),
  };
}

function mapProject(record: ProjectSummaryRecord): ProjectSummary {
  return {
    slug: record.slug,
    title: record.title,
    gloss: record.gloss,
    status: record.status,
    phase: record.phase,
    startedAt: record.startedAt?.toISOString() ?? null,
    areas: record.areas.map(({ area }) => area),
    members: record.members.map(({ member, role, isLead }) => ({
      slug: member.slug,
      name: member.name,
      role,
      isLead,
    })),
  };
}

function mapPublication(record: PublicationSummaryRecord): PublicationSummary {
  return {
    slug: record.slug,
    title: record.title,
    type: record.type,
    venueName: record.venueName,
    venueShort: record.venueShort,
    year: record.year,
    authors: record.authors.map((author) => {
      const memberIsPublic =
        author.member?.isPublic &&
        ["ACTIVE", "ALUMNI"].includes(author.member.status);

      return {
        name:
          (memberIsPublic ? author.member?.name : null) ??
          author.externalName ??
          "Author profile unavailable",
        memberSlug: memberIsPublic ? (author.member?.slug ?? null) : null,
      };
    }),
  };
}

function mapProjectUpdate(record: ProjectUpdateRecord): ProjectUpdateEntry {
  const author = record.author;
  const authorIsPublic =
    author?.isPublic === true &&
    PUBLIC_MEMBER_STATUSES.some((status) => status === author.status);

  return {
    id: record.id,
    title: record.title,
    body: record.body,
    nextUp: record.nextUp,
    stage: record.stage as ProjectStatusValue,
    phase: record.phase,
    // A member who left, or who keeps no public profile, is still credited by
    // the team internally but is not named here.
    author: authorIsPublic
      ? { name: author.name, memberSlug: author.slug }
      : null,
    postedAt: record.createdAt.toISOString(),
    attachments: mapAttachments(record.attachments),
  };
}

function uniqueBySlug<T extends { slug: string }>(records: T[]): T[] {
  return [...new Map(records.map((record) => [record.slug, record])).values()];
}

export const getResearchIndex = cache(async (): Promise<ResearchIndexData> => {
  return queryPublic({ themes: [] }, async () => {
    const themes = await getDb().researchTheme.findMany({
      where: publicThemeWhere,
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        gloss: true,
        areas: {
          where: publicAreaWhere,
          orderBy: { sortOrder: "asc" },
          select: {
            slug: true,
            name: true,
            summary: true,
            projects: {
              where: { project: publicProjectWhere },
              select: { projectId: true },
            },
            publications: {
              where: { publication: publicPublicationWhere },
              select: { publicationId: true },
            },
          },
        },
      },
    });

    return {
      themes: themes.map((theme) => ({
        slug: theme.slug,
        name: theme.name,
        gloss: theme.gloss,
        areas: theme.areas.map(({ slug, name, summary }) => ({
          slug,
          name,
          summary,
        })),
        projectCount: new Set(
          theme.areas.flatMap((area) =>
            area.projects.map(({ projectId }) => projectId),
          ),
        ).size,
        publicationCount: new Set(
          theme.areas.flatMap((area) =>
            area.publications.map(({ publicationId }) => publicationId),
          ),
        ).size,
      })),
    };
  });
});

function loadThemeDetail(
  where: Prisma.ResearchThemeWhereInput,
): Promise<ThemeDetailData | null> {
  return queryPublic(null, async () => {
    const theme = await getDb().researchTheme.findFirst({
      where,
      select: {
        slug: true,
        name: true,
        gloss: true,
        overview: true,
        areas: {
          where: publicAreaWhere,
          orderBy: { sortOrder: "asc" },
          select: {
            slug: true,
            name: true,
            summary: true,
            overview: true,
            projects: {
              where: { project: publicProjectWhere },
              select: { project: { select: projectSummarySelect } },
            },
            publications: {
              where: { publication: publicPublicationWhere },
              select: {
                publication: { select: publicationSummarySelect },
              },
            },
          },
        },
      },
    });

    if (!theme) return null;

    return {
      slug: theme.slug,
      name: theme.name,
      gloss: theme.gloss,
      overview: theme.overview,
      areas: theme.areas.map((area) => ({
        slug: area.slug,
        name: area.name,
        summary: area.summary,
        overview: area.overview,
      })),
      projects: uniqueBySlug(
        theme.areas.flatMap((area) =>
          area.projects.map(({ project }) => mapProject(project)),
        ),
      ),
      publications: uniqueBySlug(
        theme.areas.flatMap((area) =>
          area.publications.map(({ publication }) =>
            mapPublication(publication),
          ),
        ),
      ),
    };
  });
}

export const getThemeBySlug = cache(
  (slug: string): Promise<ThemeDetailData | null> =>
    loadThemeDetail({ slug, ...publicThemeWhere }),
);

/** Any record by id, as its page would show it: admin preview only. */
export function getThemeForPreview(
  id: string,
): Promise<ThemeDetailData | null> {
  return loadThemeDetail({ id });
}

function loadAreaDetail(
  where: Prisma.ResearchAreaWhereInput,
): Promise<AreaDetailData | null> {
  return queryPublic(null, async () => {
    const area = await getDb().researchArea.findFirst({
      where,
      select: {
        slug: true,
        name: true,
        summary: true,
        overview: true,
        questions: true,
        theme: {
          select: { slug: true, name: true, gloss: true },
        },
        projects: {
          where: { project: publicProjectWhere },
          select: { project: { select: projectSummarySelect } },
        },
        publications: {
          where: { publication: publicPublicationWhere },
          select: { publication: { select: publicationSummarySelect } },
        },
        members: {
          where: { member: publicMemberWhere },
          select: { member: { select: memberSummarySelect } },
        },
        resources: {
          where: { resource: publicResourceWhere },
          select: {
            resource: {
              select: {
                slug: true,
                name: true,
                kind: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!area) return null;

    const relatedAreas = await getDb().researchArea.findMany({
      where: {
        ...publicAreaWhere,
        theme: { ...publicThemeWhere, slug: area.theme.slug },
        slug: { not: area.slug },
      },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    });

    return {
      slug: area.slug,
      name: area.name,
      summary: area.summary,
      overview: area.overview,
      questions: area.questions,
      theme: area.theme,
      projects: area.projects.map(({ project }) => mapProject(project)),
      publications: area.publications.map(({ publication }) =>
        mapPublication(publication),
      ),
      researchers: area.members.map(({ member }) => mapMember(member)),
      resources: area.resources.map(({ resource }) => resource),
      relatedAreas,
    };
  });
}

export const getAreaBySlug = cache(
  (slug: string): Promise<AreaDetailData | null> =>
    loadAreaDetail({ slug, ...publicAreaWhere }),
);

/** Any record by id, as its page would show it: admin preview only. */
export function getAreaForPreview(id: string): Promise<AreaDetailData | null> {
  return loadAreaDetail({ id });
}

export async function getProjectsIndex(
  filters: ProjectFilters,
): Promise<ProjectsIndexData> {
  return queryPublic(
    { projects: [], options: { themes: [], areas: [], researchers: [] } },
    async () => {
      const relationFilters: Prisma.ProjectWhereInput[] = [];
      if (filters.theme) {
        relationFilters.push({
          areas: {
            some: {
              area: {
                ...publicAreaWhere,
                theme: { ...publicThemeWhere, slug: filters.theme },
              },
            },
          },
        });
      }
      if (filters.area) {
        relationFilters.push({
          areas: {
            some: { area: { ...publicAreaWhere, slug: filters.area } },
          },
        });
      }
      if (filters.researcher) {
        relationFilters.push({
          members: {
            some: {
              member: {
                ...publicMemberWhere,
                slug: filters.researcher,
              },
            },
          },
        });
      }

      const where: Prisma.ProjectWhereInput = {
        ...publicProjectWhere,
        status: filters.status ?? { not: "ARCHIVED" },
        ...(relationFilters.length > 0 ? { AND: relationFilters } : {}),
      };

      const [projects, themes, areas, researchers] = await Promise.all([
        getDb().project.findMany({
          where,
          orderBy: [
            { featured: "desc" },
            { startedAt: "desc" },
            { title: "asc" },
          ],
          select: projectSummarySelect,
        }),
        getDb().researchTheme.findMany({
          where: publicThemeWhere,
          orderBy: { sortOrder: "asc" },
          select: { slug: true, name: true },
        }),
        getDb().researchArea.findMany({
          where: publicAreaWhere,
          orderBy: [{ theme: { sortOrder: "asc" } }, { sortOrder: "asc" }],
          select: { slug: true, name: true },
        }),
        getDb().member.findMany({
          where: publicMemberWhere,
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { slug: true, name: true },
        }),
      ]);

      return {
        projects: projects.map(mapProject),
        options: { themes, areas, researchers },
      };
    },
  );
}

/**
 * A project as its public page shows it. Related work appears only when it
 * is public itself, so an admin preview shows exactly what visitors will see.
 */
function loadProjectDetail(
  where: Prisma.ProjectWhereInput,
): Promise<ProjectDetailData | null> {
  return queryPublic(null, async () => {
    const project = await getDb().project.findFirst({
      where,
      select: {
        ...projectSummarySelect,
        abstract: true,
        question: true,
        motivation: true,
        approach: true,
        experiments: true,
        results: true,
        resultsPublic: true,
        endedAt: true,
        codeUrl: true,
        datasetUrl: true,
        demoUrl: true,
        publications: {
          where: publicPublicationWhere,
          orderBy: [{ year: "desc" }, { title: "asc" }],
          select: publicationSummarySelect,
        },
        sections: {
          // Both halves again: a section reaches the public only when the
          // team published it and the project is published.
          where: publicProjectSectionWhere,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: projectSectionSelect,
        },
        updates: {
          // Both halves of `publicProjectUpdateWhere`: publishing a project
          // must not retroactively publish the team's working notes.
          where: publicProjectUpdateWhere,
          orderBy: { createdAt: "desc" },
          take: PUBLIC_UPDATES,
          select: projectUpdateSelect,
        },
        relatedFrom: {
          where: { to: publicProjectWhere },
          select: {
            to: { select: { slug: true, title: true, gloss: true } },
          },
        },
        relatedTo: {
          where: { from: publicProjectWhere },
          select: {
            from: { select: { slug: true, title: true, gloss: true } },
          },
        },
      },
    });

    if (!project) return null;

    const safeProject = publicProjectResearch(project);
    const links = [
      { label: "Code", href: externalUrl(project.codeUrl) },
      { label: "Dataset", href: externalUrl(project.datasetUrl) },
      { label: "Demo", href: externalUrl(project.demoUrl) },
    ].flatMap(({ label, href }) => (href ? [{ label, href }] : []));

    return {
      ...mapProject(project),
      abstract: project.abstract,
      question: project.question,
      motivation: project.motivation,
      approach: project.approach,
      experiments: safeProject.experiments,
      results: safeProject.results,
      resultsPublic: project.resultsPublic,
      endedAt: project.endedAt?.toISOString() ?? null,
      links,
      publications: project.publications.map(mapPublication),
      relatedProjects: uniqueBySlug([
        ...project.relatedFrom.map(({ to }) => to),
        ...project.relatedTo.map(({ from }) => from),
      ]),
      sections: project.sections.map(mapProjectSection),
      updates: project.updates.map(mapProjectUpdate),
    };
  });
}

export const getProjectBySlug = cache(
  (slug: string): Promise<ProjectDetailData | null> =>
    loadProjectDetail({ slug, ...publicProjectWhere }),
);

/** Any project by id, as its page would show it: admin preview only. */
export function getProjectForPreview(
  id: string,
): Promise<ProjectDetailData | null> {
  return loadProjectDetail({ id });
}

export async function getPeopleIndex(area?: string): Promise<PeopleIndexData> {
  return queryPublic({ people: [], areas: [] }, async () => {
    const [people, areas] = await Promise.all([
      getDb().member.findMany({
        where: {
          ...publicMemberWhere,
          ...(area
            ? {
                areas: {
                  some: { area: { ...publicAreaWhere, slug: area } },
                },
              }
            : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: memberSummarySelect,
      }),
      getDb().researchArea.findMany({
        where: publicAreaWhere,
        orderBy: [{ theme: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        select: { slug: true, name: true },
      }),
    ]);

    return { people: people.map(mapMember), areas };
  });
}

export const getPersonBySlug = cache(
  async (slug: string): Promise<PersonDetailData | null> =>
    queryPublic(null, async () => {
      const person = await getDb().member.findFirst({
        where: { slug, ...publicMemberWhere },
        select: {
          ...memberSummarySelect,
          bio: true,
          orgEmail: true,
          showOrgEmail: true,
          scholarUrl: true,
          orcid: true,
          githubUrl: true,
          linkedinUrl: true,
          websiteUrl: true,
          projects: {
            where: { project: publicProjectWhere },
            orderBy: [{ isLead: "desc" }, { sortOrder: "asc" }],
            select: { project: { select: projectSummarySelect } },
          },
          authorships: {
            where: { publication: publicPublicationWhere },
            orderBy: { position: "asc" },
            select: {
              publication: { select: publicationSummarySelect },
            },
          },
          insights: {
            where: { insight: publicInsightWhere },
            orderBy: { position: "asc" },
            select: {
              insight: {
                select: {
                  slug: true,
                  title: true,
                  summary: true,
                  publishedAt: true,
                },
              },
            },
          },
        },
      });

      if (!person) return null;

      const links = [
        { label: "Google Scholar", href: externalUrl(person.scholarUrl) },
        {
          label: "ORCID",
          href: person.orcid
            ? externalUrl(
                person.orcid.startsWith("http")
                  ? person.orcid
                  : `https://orcid.org/${person.orcid}`,
              )
            : null,
        },
        { label: "GitHub", href: externalUrl(person.githubUrl) },
        { label: "LinkedIn", href: externalUrl(person.linkedinUrl) },
        { label: "Personal site", href: externalUrl(person.websiteUrl) },
      ].flatMap(({ label, href }) => (href ? [{ label, href }] : []));

      return {
        ...mapMember(person),
        bio: person.bio,
        orgEmail: person.showOrgEmail ? person.orgEmail : null,
        links,
        projects: person.projects.map(({ project }) => mapProject(project)),
        publications: uniqueBySlug(
          person.authorships.map(({ publication }) =>
            mapPublication(publication),
          ),
        ),
        notes: person.insights.map(({ insight }) => ({
          ...insight,
          publishedAt: insight.publishedAt?.toISOString() ?? null,
        })),
      };
    }),
);

export const getAboutData = cache(async (): Promise<AboutData> => {
  return queryPublic({ milestones: [], leadership: [] }, async () => {
    const [milestones, leadership] = await Promise.all([
      getDb().milestone.findMany({
        where: { isPublic: true },
        orderBy: { date: "asc" },
        select: { id: true, date: true, title: true, body: true },
      }),
      getDb().member.findMany({
        where: {
          ...publicMemberWhere,
          status: "ACTIVE",
          rank: { in: ["DIRECTOR", "RESEARCH_LEAD"] },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: memberSummarySelect,
      }),
    ]);

    return {
      milestones: milestones.map((milestone) => ({
        ...milestone,
        date: milestone.date.toISOString(),
      })),
      leadership: leadership.map(mapMember),
    };
  });
});
