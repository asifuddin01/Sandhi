import "server-only";

import { cache, type ReactNode } from "react";

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
import {
  publicAreaWhere,
  publicEventWhere,
  publicNewsWhere,
  publicOpportunityWhere,
  publicPartnerWhere,
  publicProjectWhere,
  publicPublicationWhere,
  publicResourceWhere,
  publicThemeWhere,
} from "@/lib/visibility";

import { OnPageBar } from "./OnPageBar";

const bySlug = (slug: string) => ({ where: { slug }, select: { id: true } });

// A list page asks for the same choices once per editor it offers.
const themeOptions = cache(getThemeOptions);
const areaOptions = cache(getResearchAreaOptions);
const newsOptions = cache(getNewsLinkOptions);
const resourceOptions = cache(getResourceLinkOptions);
const publicationOptions = cache(getPublicationLinkOptions);

/**
 * The newest records a visitor cannot see (and that are not retired), as the
 * inverse of the visibility rule, so the two cannot drift apart.
 * ponytail: every editor a bar offers is rendered with the page, so this
 * stops at six; load an editor when it is opened if staff pages get slow.
 */
const hidden = <Where,>(visible: Where) => ({
  where: { NOT: visible, state: { not: "ARCHIVED" as const } },
  orderBy: { updatedAt: "desc" as const },
  take: 6,
});
const named = (rows: Array<{ slug: string; name: string }>) =>
  rows.map(({ slug, name }) => ({ key: slug, title: name }));
const titled = (rows: Array<{ slug: string; title: string }>) =>
  rows.map(({ slug, title }) => ({ key: slug, title }));

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
    async waiting() {
      return named(
        await getDb().researchTheme.findMany({
          ...hidden(publicThemeWhere),
          select: { slug: true, name: true },
        }),
      );
    },
  },
  area: {
    capability: "research:manage",
    add: "Add a research area",
    edit: "Edit this area",
    async editor(slug?: string) {
      const themes = await themeOptions();
      if (!slug) return <AreaEditor themes={themes} />;
      const row = await getDb().researchArea.findUnique(bySlug(slug));
      const area = row && (await getAreaForEdit(row.id));
      return area ? <AreaEditor area={area} themes={themes} /> : null;
    },
    async waiting() {
      return named(
        await getDb().researchArea.findMany({
          ...hidden(publicAreaWhere),
          select: { slug: true, name: true },
        }),
      );
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
    async waiting() {
      return titled(
        await getDb().project.findMany({
          ...hidden(publicProjectWhere),
          select: { slug: true, title: true },
        }),
      );
    },
  },
  publication: {
    capability: "publications:publish",
    add: "Add a publication",
    edit: "Edit this publication",
    async editor(slug?: string) {
      const options = await publicationOptions();
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
    async waiting() {
      return titled(
        await getDb().publication.findMany({
          ...hidden(publicPublicationWhere),
          select: { slug: true, title: true },
        }),
      );
    },
  },
  news: {
    capability: "content:manage",
    add: "Add news",
    edit: "Edit this post",
    async editor(slug?: string) {
      const options = await newsOptions();
      if (!slug) return <NewsEditor options={options} />;
      const row = await getDb().newsPost.findUnique(bySlug(slug));
      const post = row && (await getNewsForEdit(row.id));
      return post ? <NewsEditor post={post} options={options} /> : null;
    },
    async waiting() {
      return titled(
        await getDb().newsPost.findMany({
          ...hidden(publicNewsWhere()),
          select: { slug: true, title: true },
        }),
      );
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
    async waiting() {
      return titled(
        await getDb().event.findMany({
          ...hidden(publicEventWhere()),
          select: { slug: true, title: true },
        }),
      );
    },
  },
  opportunity: {
    capability: "opportunities:manage",
    add: "Add an opportunity",
    edit: "Edit this opportunity",
    async editor(slug?: string) {
      const areas = await areaOptions();
      if (!slug) return <OpportunityEditor areas={areas} />;
      const row = await getDb().opportunity.findUnique(bySlug(slug));
      const opportunity = row && (await getOpportunityForEdit(row.id));
      return opportunity ? (
        <OpportunityEditor opportunity={opportunity} areas={areas} />
      ) : null;
    },
    async waiting() {
      return titled(
        await getDb().opportunity.findMany({
          ...hidden(publicOpportunityWhere()),
          select: { slug: true, title: true },
        }),
      );
    },
  },
  resource: {
    capability: "content:manage",
    add: "Add a resource",
    edit: "Edit this resource",
    async editor(slug?: string) {
      const options = await resourceOptions();
      if (!slug) return <ResourceEditor options={options} />;
      const row = await getDb().resource.findUnique(bySlug(slug));
      const resource = row && (await getResourceForEdit(row.id));
      return resource ? (
        <ResourceEditor resource={resource} options={options} />
      ) : null;
    },
    async waiting() {
      return named(
        await getDb().resource.findMany({
          ...hidden(publicResourceWhere),
          select: { slug: true, name: true },
        }),
      );
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
    async waiting() {
      const rows = await getDb().partner.findMany({
        ...hidden(publicPartnerWhere),
        select: { id: true, name: true },
      });
      return rows.map(({ id, name }) => ({ key: id, title: name }));
    },
  },
} satisfies Record<
  string,
  {
    capability: Capability;
    add: string;
    edit: string;
    editor(key?: string): Promise<ReactNode>;
    waiting(): Promise<Array<{ key: string; title: string }>>;
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
  // Where a kind can be added, what was added but is not on the site yet is
  // offered too: otherwise a draft could only be found in administration.
  const waiting = await Promise.all(
    allowed
      .filter(({ key }) => !key)
      .map(async ({ kind }) =>
        (await kinds[kind].waiting()).map(({ key, title }) => ({
          kind,
          key,
          label: `Not on the site: ${title}`,
        })),
      ),
  );
  const editors = await Promise.all(
    [...allowed, ...waiting.flat()].map(async ({ kind, key, label }) => ({
      label: label ?? (key ? kinds[kind].edit : kinds[kind].add),
      editor: await kinds[kind].editor(key),
      adding: !key,
    })),
  );
  const shown = editors.filter(({ editor }) => editor !== null);
  return shown.length > 0 ? <OnPageBar actions={shown} /> : null;
}
