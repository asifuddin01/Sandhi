import "server-only";

import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  APPLICATION_STATUSES,
  isApplicationType,
  type ApplicationStatusValue,
} from "@/lib/applications";

/**
 * The review side of applications. Everything here sits behind
 * `applications:manage`, and none of it is public: somebody wrote to the lab
 * about themselves, their work and their circumstances.
 */

export const APPLICATIONS_PAGE_SIZE = 25;

export interface ApplicationsIndex {
  applications: Array<{
    id: string;
    name: string;
    email: string;
    institution: string;
    currentRole: string;
    type: string;
    status: string;
    rating: number | null;
    createdAt: Date;
    opportunity: { title: string } | null;
    notes: number;
  }>;
  total: number;
  page: number;
  pages: number;
  /** How many sit in each state, for the filter row. */
  counts: Record<string, number>;
  /** How many are still waiting on the lab, whatever the current filter. */
  open: number;
}

export async function getApplicationsIndex({
  status,
  type,
  query,
  page = 1,
}: {
  status?: string;
  type?: string;
  query?: string;
  page?: number;
}): Promise<ApplicationsIndex> {
  const empty: ApplicationsIndex = {
    applications: [],
    total: 0,
    page: 1,
    pages: 1,
    counts: {},
    open: 0,
  };
  if (!isDatabaseConfigured()) return empty;

  const db = getDb();
  const wanted = (APPLICATION_STATUSES as readonly string[]).includes(
    status ?? "",
  )
    ? (status as ApplicationStatusValue)
    : undefined;
  const wantedType = type && isApplicationType(type) ? type : undefined;
  const text = query?.trim();

  const where = {
    ...(wanted ? { status: wanted } : {}),
    ...(wantedType ? { type: wantedType as never } : {}),
    ...(text
      ? {
          OR: [
            { name: { contains: text, mode: "insensitive" as const } },
            { email: { contains: text, mode: "insensitive" as const } },
            { institution: { contains: text, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const current = Math.max(1, page);
  const [rows, total, grouped] = await Promise.all([
    db.application.findMany({
      where,
      // Oldest first among the ones still waiting would be fairer, but the
      // queue is read newest-first like every other manager here; the open
      // count above tells the reader how much is outstanding.
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * APPLICATIONS_PAGE_SIZE,
      take: APPLICATIONS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        institution: true,
        currentRole: true,
        type: true,
        status: true,
        rating: true,
        createdAt: true,
        opportunity: { select: { title: true } },
        _count: { select: { notes: true } },
      },
    }),
    db.application.count({ where }),
    db.application.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(
    grouped.map((group) => [group.status, group._count._all]),
  );

  return {
    applications: rows.map(({ _count, ...row }) => ({
      ...row,
      notes: _count.notes,
    })),
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE)),
    counts,
    open:
      (counts.NEW ?? 0) +
      (counts.IN_REVIEW ?? 0) +
      (counts.SHORTLISTED ?? 0) +
      (counts.INTERVIEW ?? 0),
  };
}

export async function getApplication(id: string) {
  if (!isDatabaseConfigured()) return null;

  return getDb().application.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      status: true,
      name: true,
      email: true,
      phone: true,
      institution: true,
      currentRole: true,
      interests: true,
      scholarUrl: true,
      orcid: true,
      githubUrl: true,
      linkedinUrl: true,
      websiteUrl: true,
      motivation: true,
      experience: true,
      proposalTitle: true,
      proposalSummary: true,
      hoursPerWeek: true,
      rating: true,
      consent: true,
      createdAt: true,
      updatedAt: true,
      // The keys themselves never reach the page: a file is reached through
      // `/files/applications/[id]/[kind]`, which authorizes the reader and
      // then signs a short-lived link.
      cvKey: true,
      proposalKey: true,
      opportunity: { select: { slug: true, title: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
}

/** Whether this address already has an account, so the page can say so. */
export async function hasAccount(email: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const user = await getDb().user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return user !== null;
}
