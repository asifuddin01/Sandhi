import "server-only";

import type { ReactNode } from "react";

import { EventEditor } from "@/app/admin/events/EventEditor";
import { NewsEditor } from "@/app/admin/news/NewsEditor";
import { OpportunityEditor } from "@/app/admin/opportunities/OpportunityEditor";
import { PartnerEditor } from "@/app/admin/partners/PartnerEditor";
import { ProjectEditor } from "@/app/admin/projects/ProjectEditor";
import { PublicationEditor } from "@/app/admin/publications/PublicationEditor";
import { AreaEditor, ThemeEditor } from "@/app/admin/research/ResearchEditors";
import { ResourceEditor } from "@/app/admin/resources/ResourceEditor";
import { getEventForEdit } from "@/lib/admin/events";
import { getNewsForEdit, getNewsLinkOptions } from "@/lib/admin/news";
import {
  getOpportunityForEdit,
  getResearchAreaOptions,
} from "@/lib/admin/opportunities";
import { getPartnerForEdit } from "@/lib/admin/partners";
import { getProjectForEdit, getProjectOptions } from "@/lib/admin/projects";
import {
  getPublicationForEdit,
  getPublicationLinkOptions,
  publicationDraft,
} from "@/lib/admin/publications";
import {
  getAreaForEdit,
  getThemeForEdit,
  getThemeOptions,
} from "@/lib/admin/research";
import {
  getResourceForEdit,
  getResourceLinkOptions,
} from "@/lib/admin/resources";
import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { can, type Capability } from "@/lib/permissions";

import { OnPageBar } from "./OnPageBar";

const bySlug = (slug: string) => ({ where: { slug }, select: { id: true } });

/**
 * Each kind of record, the capability its admin page asks for, and its
 * editor: empty for a new record, or filled from the page's address (a
 * partner has no address, so its key is its id).
 */
const kinds = {
  theme: {
    capability: "research:manage",
    add: "Add a theme",
    edit: "Edit this theme",
    async editor(slug?: string) {
      if (!slug) return <ThemeEditor />;
      const row = await getDb().researchTheme.findUnique(bySlug(slug));
      const theme = row && (await getThemeForEdit(row.id));
      return theme ? <ThemeEditor theme={theme} /> : null;
    },
  },
  area: {
    capability: "research:manage",
    add: "Add a research area",
    edit: "Edit this area",
    async editor(slug?: string) {
      const themes = await getThemeOptions();
      if (!slug) return <AreaEditor themes={themes} />;
      const row = await getDb().researchArea.findUnique(bySlug(slug));
      const area = row && (await getAreaForEdit(row.id));
      return area ? <AreaEditor area={area} themes={themes} /> : null;
    },
  },
  project: {
    capability: "projects:manage",
    add: "Add a project",
    edit: "Edit this project",
    async editor(slug?: string) {
      if (!slug) return <ProjectEditor options={await getProjectOptions()} />;
      const row = await getDb().project.findUnique(bySlug(slug));
      const project = row && (await getProjectForEdit(row.id));
      return project ? (
        <ProjectEditor
          project={project}
          options={await getProjectOptions(project.id)}
        />
      ) : null;
    },
  },
  publication: {
    capability: "publications:publish",
    add: "Add a publication",
    edit: "Edit this publication",
    async editor(slug?: string) {
      const options = await getPublicationLinkOptions();
      if (!slug) return <PublicationEditor options={options} />;
      const row = await getDb().publication.findUnique(bySlug(slug));
      const publication = row && (await getPublicationForEdit(row.id));
      return publication ? (
        <PublicationEditor
          options={options}
          publication={publicationDraft(publication)}
        />
      ) : null;
    },
  },
  news: {
    capability: "content:manage",
    add: "Add news",
    edit: "Edit this post",
    async editor(slug?: string) {
      const options = await getNewsLinkOptions();
      if (!slug) return <NewsEditor options={options} />;
      const row = await getDb().newsPost.findUnique(bySlug(slug));
      const post = row && (await getNewsForEdit(row.id));
      return post ? <NewsEditor post={post} options={options} /> : null;
    },
  },
  event: {
    capability: "content:manage",
    add: "Add an event",
    edit: "Edit this event",
    async editor(slug?: string) {
      if (!slug) return <EventEditor />;
      const row = await getDb().event.findUnique(bySlug(slug));
      const event = row && (await getEventForEdit(row.id));
      return event ? <EventEditor event={event} /> : null;
    },
  },
  opportunity: {
    capability: "opportunities:manage",
    add: "Add an opportunity",
    edit: "Edit this opportunity",
    async editor(slug?: string) {
      const areas = await getResearchAreaOptions();
      if (!slug) return <OpportunityEditor areas={areas} />;
      const row = await getDb().opportunity.findUnique(bySlug(slug));
      const opportunity = row && (await getOpportunityForEdit(row.id));
      return opportunity ? (
        <OpportunityEditor opportunity={opportunity} areas={areas} />
      ) : null;
    },
  },
  resource: {
    capability: "content:manage",
    add: "Add a resource",
    edit: "Edit this resource",
    async editor(slug?: string) {
      const options = await getResourceLinkOptions();
      if (!slug) return <ResourceEditor options={options} />;
      const row = await getDb().resource.findUnique(bySlug(slug));
      const resource = row && (await getResourceForEdit(row.id));
      return resource ? (
        <ResourceEditor resource={resource} options={options} />
      ) : null;
    },
  },
  partner: {
    capability: "partners:manage",
    add: "Add a partner",
    edit: "Edit this partner",
    async editor(id?: string) {
      if (!id) return <PartnerEditor />;
      const partner = await getPartnerForEdit(id);
      return partner ? <PartnerEditor partner={partner} /> : null;
    },
  },
} satisfies Record<
  string,
  {
    capability: Capability;
    add: string;
    edit: string;
    editor(key?: string): Promise<ReactNode>;
  }
>;

export type OnPageAction = {
  kind: keyof typeof kinds;
  /** The record's address; leave out to add a new one. */
  key?: string;
  /** Replaces "Edit this …" where a page lists several records. */
  label?: string;
};

/**
 * The administration editors, on the public page they change, so nobody has
 * to leave the page to correct it. Nothing is drawn, and nothing loaded, for
 * a viewer who may not make the change; the editors' own actions check the
 * same capability again and record the audit entry.
 */
export async function EditOnPage({ actions }: { actions: OnPageAction[] }) {
  const viewer = await getViewer();
  if (!viewer || !isDatabaseConfigured()) return null;

  const allowed = actions.filter(({ kind }) =>
    can(viewer.role, kinds[kind].capability),
  );
  const editors = await Promise.all(
    allowed.map(async ({ kind, key, label }) => ({
      label: label ?? (key ? kinds[kind].edit : kinds[kind].add),
      editor: await kinds[kind].editor(key),
    })),
  );
  const shown = editors.filter(({ editor }) => editor !== null);
  return shown.length > 0 ? <OnPageBar actions={shown} /> : null;
}
