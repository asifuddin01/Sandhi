"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import {
  AdminActionError,
  invalidate,
  recordAudit,
  runAdminAction,
  type ActionState,
} from "@/lib/admin/actions";
import {
  changes,
  checkbox,
  dhakaTime,
  field,
  isUniqueConflict,
  lines,
  markdownText,
  oneOf,
  optionalText,
  requiredText,
  runBulk,
} from "@/lib/admin/content-actions";
import { cacheTags } from "@/lib/cache-tags";
import { slugProblem, unscheduledStates } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { OPPORTUNITY_KINDS } from "@/lib/public-opportunities";

async function readOpportunity(formData: FormData) {
  const title = requiredText(formData, "title", "a title", 200);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);

  const requested = [
    ...new Set(
      formData
        .getAll("areaSlugs")
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const known = await getDb().researchArea.findMany({
    where: { slug: { in: requested } },
    select: { slug: true },
  });
  if (known.length !== requested.length) {
    throw new AdminActionError("One of the research areas no longer exists.");
  }

  return {
    title,
    slug,
    kind: oneOf(
      field(formData, "kind"),
      OPPORTUNITY_KINDS,
      "Choose a kind of opportunity.",
    ),
    areaSlugs: requested,
    description: markdownText(
      formData,
      "description",
      "the description",
      20_000,
    ),
    responsibilities: lines(formData, "responsibilities", "responsibilities"),
    requirements: lines(formData, "requirements", "requirements"),
    duration: optionalText(formData, "duration", "the duration", 120),
    location: optionalText(formData, "location", "the location", 200),
    isRemote: checkbox(formData, "isRemote"),
    deadline: dhakaTime(formData, "deadline", "deadline"),
    state: oneOf(
      field(formData, "state"),
      unscheduledStates,
      "Choose a state.",
    ),
  };
}

export async function saveOpportunityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction(
    "opportunities:manage",
    async (viewer) => {
      const data = await readOpportunity(formData);
      const db = getDb();
      try {
        if (!id) {
          const created = await db.$transaction(async (transaction) => {
            const opportunity = await transaction.opportunity.create({
              data,
              select: { id: true },
            });
            await recordAudit(transaction, {
              actorId: viewer.userId,
              action: "opportunity.create",
              entity: "Opportunity",
              entityId: opportunity.id,
              diff: { title: data.title, state: data.state },
            });
            return opportunity;
          });
          createdId = created.id;
        } else {
          const before = await db.opportunity.findUnique({ where: { id } });
          if (!before) {
            throw new AdminActionError("That opportunity no longer exists.");
          }
          const diff = changes(before, data, ["description"]);
          if (Object.keys(diff).length === 0) {
            return { status: "success", message: "Nothing changed." };
          }
          await db.$transaction(async (transaction) => {
            await transaction.opportunity.update({ where: { id }, data });
            await recordAudit(transaction, {
              actorId: viewer.userId,
              action: "opportunity.update",
              entity: "Opportunity",
              entityId: id,
              diff: diff as Prisma.InputJsonValue,
            });
          });
        }
      } catch (error) {
        if (isUniqueConflict(error)) {
          throw new AdminActionError(
            "Another opportunity already uses that address. Choose a different one.",
          );
        }
        throw error;
      }
      invalidate(cacheTags.opportunities);
      return { status: "success", message: "Saved." };
    },
  );

  revalidatePath("/admin/opportunities");
  if (createdId) redirect(`/admin/opportunities/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/opportunities/${id}`);
  return result;
}

export async function bulkOpportunitiesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction(
    "opportunities:manage",
    async (viewer) => {
      const outcome = await runBulk(viewer, formData, {
        entity: "Opportunity",
        prefix: "opportunity",
        noun: { one: "opportunity", many: "opportunities" },
        load: (ids) =>
          getDb().opportunity.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              state: true,
              _count: { select: { applications: true } },
            },
          }),
        // Applications would lose the opening they answered.
        keep: (row) =>
          row._count.applications > 0
            ? "people have applied: archive it instead"
            : null,
        update: (transaction, id, data) =>
          transaction.opportunity.update({ where: { id }, data }),
        remove: (transaction, id) =>
          transaction.opportunity.delete({ where: { id } }),
      });
      invalidate(cacheTags.opportunities);
      return outcome;
    },
  );
  revalidatePath("/admin/opportunities");
  return result;
}
