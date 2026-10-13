import "server-only";

import type { ReactNode } from "react";

import { setMemberAreaAction } from "@/app/admin/members/actions";
import { ProjectEditor } from "@/app/admin/projects/ProjectEditor";
import { PublicationEditor } from "@/app/admin/publications/PublicationEditor";
import {
  placeInAreaAction,
  saveResearchPartAction,
} from "@/app/admin/research/actions";
import { AreaEditor } from "@/app/admin/research/ResearchEditors";
import { ResourceEditor } from "@/app/admin/resources/ResourceEditor";
import research from "@/components/public/ResearchPages.module.css";
import { getProjectOptions } from "@/lib/admin/projects";
import { getPublicationLinkOptions } from "@/lib/admin/publications";
import { getThemeOptions } from "@/lib/admin/research";
import { getResourceLinkOptions } from "@/lib/admin/resources";
import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { can, type Capability } from "@/lib/permissions";
import { isPublicationPublic } from "@/lib/visibility";

import styles from "./Admin.module.css";
import { ActionForm, SubmitButton } from "./AdminForms";
import { MarkdownField } from "./ContentFields";
import { SectionControl } from "./SectionControl";

/**
 * The controls an area's or a theme's public page puts in its own sections:
 * "Add" or "Edit" beside each heading, opening the form for that section
 * alone. What a theme or an area is called, its address and where it sits
 * are not offered here: those are fixed, and stay in administration.
 *
 * Each control is made only for someone who may use it, and the actions
 * check the same capability again. Nobody else is told they exist.
 */

type Row = { id: string; title: string; inArea: boolean; live: boolean };

const notYet = "not on the site yet";

function OverviewForm({
  kind,
  id,
  overview,
}: {
  kind: "area" | "theme";
  id: string;
  overview: string | null;
}) {
  return (
    <ActionForm action={saveResearchPartAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="part" value="overview" />
      <MarkdownField
        id="overview"
        name="overview"
        label="Overview"
        defaultValue={overview ?? ""}
        rows={12}
        hint="Markdown. Leave it empty to show nothing yet."
      />
      <SubmitButton pending="Saving…">Save overview</SubmitButton>
    </ActionForm>
  );
}

/** Existing records to put in the area, a new one to write, and those in it. */
function Placement({
  kind,
  noun,
  areaId,
  rows,
  children,
}: {
  kind: "project" | "publication" | "resource";
  noun: string;
  areaId: string;
  rows: Row[];
  children: ReactNode;
}) {
  const inArea = rows.filter((row) => row.inArea);
  const others = rows.filter((row) => !row.inArea);
  return (
    <>
      {others.length > 0 ? (
        <ActionForm action={placeInAreaAction} className={research.adminRow}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="areaId" value={areaId} />
          <label htmlFor={`place-${kind}`}>An existing {noun}</label>
          <select id={`place-${kind}`} name="recordId" defaultValue="" required>
            <option value="" disabled>
              Choose one
            </option>
            {others.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
                {row.live ? "" : ` (${notYet})`}
              </option>
            ))}
          </select>
          <SubmitButton tone="quiet" pending="Adding…">
            Add to this area
          </SubmitButton>
        </ActionForm>
      ) : null}

      <details open={others.length === 0}>
        <summary>
          {others.length > 0 ? `Or write a new ${noun}` : `Write a new ${noun}`}
        </summary>
        <p className={styles.hint}>
          It shows here once its state is Published. Until then it is listed
          below as {notYet}.
        </p>
        {children}
      </details>

      {inArea.length > 0 ? (
        <div>
          <h3>In this area</h3>
          <ul className={styles.rows}>
            {inArea.map((row) => (
              <li key={row.id}>
                <span>
                  {row.title}
                  {row.live ? "" : ` · ${notYet}`}
                </span>
                <ActionForm
                  action={placeInAreaAction}
                  className={styles.inlineForm}
                >
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="areaId" value={areaId} />
                  <input type="hidden" name="recordId" value={row.id} />
                  <input type="hidden" name="remove" value="yes" />
                  <SubmitButton
                    tone="quiet"
                    pending="Removing…"
                    label={`Remove ${row.title} from this area`}
                  >
                    Remove
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function Researchers({
  areaSlug,
  members,
}: {
  areaSlug: string;
  members: Array<{
    slug: string;
    name: string;
    isPublic: boolean;
    areas: Array<{ isLead: boolean }>;
  }>;
}) {
  const here = members.filter((member) => member.areas.length > 0);
  const others = members.filter((member) => member.areas.length === 0);
  return (
    <>
      {others.length > 0 ? (
        <ActionForm action={setMemberAreaAction} className={research.adminRow}>
          <input type="hidden" name="areaSlug" value={areaSlug} />
          <label htmlFor="area-researcher">Researcher</label>
          <select id="area-researcher" name="slug" defaultValue="" required>
            <option value="" disabled>
              Choose one
            </option>
            {others.map((member) => (
              <option key={member.slug} value={member.slug}>
                {member.name}
                {member.isPublic ? "" : " (not shown on People)"}
              </option>
            ))}
          </select>
          <label className={research.adminCheck}>
            <input type="checkbox" name="isLead" value="yes" />
            as lead
          </label>
          <SubmitButton tone="quiet" pending="Adding…">
            Add to this area
          </SubmitButton>
        </ActionForm>
      ) : (
        <p className={styles.hint}>Everyone in the lab is in this area.</p>
      )}

      {here.length > 0 ? (
        <div>
          <h3>In this area</h3>
          <ul className={styles.rows}>
            {here.map((member) => {
              const isLead = member.areas[0]?.isLead ?? false;
              return (
                <li key={member.slug}>
                  <span>
                    {member.name}
                    {isLead ? " · lead" : ""}
                    {member.isPublic ? "" : " · not shown on People"}
                  </span>
                  <span className={styles.rowActions}>
                    <ActionForm
                      action={setMemberAreaAction}
                      className={styles.inlineForm}
                    >
                      <input type="hidden" name="slug" value={member.slug} />
                      <input type="hidden" name="areaSlug" value={areaSlug} />
                      <input
                        type="hidden"
                        name="isLead"
                        value={isLead ? "no" : "yes"}
                      />
                      <SubmitButton
                        tone="quiet"
                        pending="Saving…"
                        label={`${isLead ? "Not lead" : "Make lead"}: ${member.name}`}
                      >
                        {isLead ? "Not lead" : "Make lead"}
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm
                      action={setMemberAreaAction}
                      className={styles.inlineForm}
                    >
                      <input type="hidden" name="slug" value={member.slug} />
                      <input type="hidden" name="areaSlug" value={areaSlug} />
                      <input type="hidden" name="remove" value="yes" />
                      <SubmitButton
                        tone="quiet"
                        pending="Removing…"
                        label={`Remove ${member.name} from this area`}
                      >
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** Who is looking, if they may change anything at all here. */
async function staff() {
  const viewer = await getViewer();
  if (!viewer || !isDatabaseConfigured()) return null;
  // Every capability used below belongs to staff; members stop here.
  if (!can(viewer.role, "admin:access")) return null;
  return (capability: Capability) => can(viewer.role, capability);
}

const inThisArea = (areaId: string) => ({
  where: { areaId },
  select: { areaId: true },
});
const current = { state: { not: "ARCHIVED" as const } };

export type AreaControls = Partial<
  Record<
    | "overview"
    | "questions"
    | "projects"
    | "publications"
    | "researchers"
    | "resources"
    | "related",
    ReactNode
  >
>;

export async function areaControls(slug: string): Promise<AreaControls> {
  const may = await staff();
  if (!may) return {};
  const db = getDb();
  const area = await db.researchArea.findUnique({
    where: { slug },
    select: { id: true, themeId: true, overview: true, questions: true },
  });
  if (!area) return {};
  const controls: AreaControls = {};

  if (may("research:manage")) {
    controls.overview = (
      <SectionControl
        id="overview"
        label={area.overview ? "Edit" : "Add"}
        about="overview"
      >
        <OverviewForm kind="area" id={area.id} overview={area.overview} />
      </SectionControl>
    );
    controls.questions = (
      <SectionControl
        id="questions"
        label={area.questions.length > 0 ? "Edit" : "Add"}
        about="open questions"
      >
        <ActionForm action={saveResearchPartAction}>
          <input type="hidden" name="kind" value="area" />
          <input type="hidden" name="id" value={area.id} />
          <input type="hidden" name="part" value="questions" />
          <div className={styles.field}>
            <label htmlFor="questions">Open questions</label>
            <textarea
              id="questions"
              name="questions"
              rows={6}
              defaultValue={area.questions.join("\n")}
              aria-describedby="questions-hint"
            />
            <p id="questions-hint" className={styles.hint}>
              One per line, in the order they should be read.
            </p>
          </div>
          <SubmitButton pending="Saving…">Save questions</SubmitButton>
        </ActionForm>
      </SectionControl>
    );
  }

  const [projects, publications, resources, members] = await Promise.all([
    may("projects:manage")
      ? Promise.all([
          getProjectOptions(),
          db.project.findMany({
            where: current,
            orderBy: { title: "asc" },
            take: 300,
            select: {
              id: true,
              title: true,
              state: true,
              areas: inThisArea(area.id),
            },
          }),
        ])
      : null,
    may("publications:publish")
      ? Promise.all([
          getPublicationLinkOptions(),
          db.publication.findMany({
            where: current,
            orderBy: { title: "asc" },
            take: 300,
            select: {
              id: true,
              title: true,
              state: true,
              stage: true,
              type: true,
              arxivId: true,
              areas: inThisArea(area.id),
            },
          }),
        ])
      : null,
    may("content:manage")
      ? Promise.all([
          getResourceLinkOptions(),
          db.resource.findMany({
            where: current,
            orderBy: { name: "asc" },
            take: 300,
            select: {
              id: true,
              name: true,
              state: true,
              areas: inThisArea(area.id),
            },
          }),
        ])
      : null,
    may("members:manage")
      ? db.member.findMany({
          where: { status: { in: ["ACTIVE", "ALUMNI"] } },
          orderBy: { name: "asc" },
          take: 500,
          select: {
            slug: true,
            name: true,
            isPublic: true,
            areas: { where: { areaId: area.id }, select: { isLead: true } },
          },
        })
      : null,
  ]);

  if (projects) {
    const [options, rows] = projects;
    controls.projects = (
      <SectionControl id="projects" label="Add" about="projects">
        <Placement
          kind="project"
          noun="project"
          areaId={area.id}
          rows={rows.map((row) => ({
            id: row.id,
            title: row.title,
            inArea: row.areas.length > 0,
            live: row.state === "PUBLISHED",
          }))}
        >
          <ProjectEditor options={options} inAreas={[area.id]} />
        </Placement>
      </SectionControl>
    );
  }
  if (publications) {
    const [options, rows] = publications;
    controls.publications = (
      <SectionControl id="publications" label="Add" about="publications">
        <Placement
          kind="publication"
          noun="publication"
          areaId={area.id}
          rows={rows.map((row) => ({
            id: row.id,
            title: row.title,
            inArea: row.areas.length > 0,
            live: isPublicationPublic(row),
          }))}
        >
          <PublicationEditor options={options} inAreas={[area.id]} />
        </Placement>
      </SectionControl>
    );
  }
  if (resources) {
    const [options, rows] = resources;
    controls.resources = (
      <SectionControl id="resources" label="Add" about="resources">
        <Placement
          kind="resource"
          noun="resource"
          areaId={area.id}
          rows={rows.map((row) => ({
            id: row.id,
            title: row.name,
            inArea: row.areas.length > 0,
            live: row.state === "PUBLISHED",
          }))}
        >
          <ResourceEditor options={options} inAreas={[area.id]} />
        </Placement>
      </SectionControl>
    );
  }
  if (may("research:manage")) {
    // The areas related to this one are the others in its theme.
    controls.related = (
      <SectionControl id="related" label="Add" about="related areas">
        <AreaEditor themes={await getThemeOptions()} inTheme={area.themeId} />
      </SectionControl>
    );
  }
  if (members) {
    controls.researchers = (
      <SectionControl id="researchers" label="Add" about="researchers">
        <Researchers areaSlug={slug} members={members} />
      </SectionControl>
    );
  }
  return controls;
}

export type ThemeControls = Partial<
  Record<"overview" | "areas" | "projects" | "publications", ReactNode>
>;

export async function themeControls(slug: string): Promise<ThemeControls> {
  const may = await staff();
  if (!may) return {};
  const theme = await getDb().researchTheme.findUnique({
    where: { slug },
    select: { id: true, overview: true },
  });
  if (!theme) return {};
  const controls: ThemeControls = {};
  // A project or a publication reaches a theme through one of its areas.
  const throughAnArea = (
    <p className={styles.hint}>
      It shows here once it is Published and in one of this theme’s areas: tick
      the area under “Research areas” below.
    </p>
  );

  if (may("research:manage")) {
    controls.overview = (
      <SectionControl
        id="overview"
        label={theme.overview ? "Edit" : "Add"}
        about="overview"
      >
        <OverviewForm kind="theme" id={theme.id} overview={theme.overview} />
      </SectionControl>
    );
    controls.areas = (
      <SectionControl id="areas" label="Add" about="research areas">
        <AreaEditor themes={await getThemeOptions()} inTheme={theme.id} />
      </SectionControl>
    );
  }
  if (may("projects:manage")) {
    controls.projects = (
      <SectionControl id="projects" label="Add" about="projects">
        {throughAnArea}
        <ProjectEditor options={await getProjectOptions()} />
      </SectionControl>
    );
  }
  if (may("publications:publish")) {
    controls.publications = (
      <SectionControl id="publications" label="Add" about="publications">
        {throughAnArea}
        <PublicationEditor options={await getPublicationLinkOptions()} />
      </SectionControl>
    );
  }
  return controls;
}
