"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { Prisma } from "@/generated/prisma/client";
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
  field,
  isUniqueConflict,
  optionalHttpsUrl,
  optionalText,
  requiredText,
  runBulk,
  uniqueConflictTarget,
} from "@/lib/admin/content-actions";
import {
  parsePublicationStage,
  parsePublicationType,
  parseReviewDecision,
  type ImportState,
} from "@/lib/publications";
import { authorize, AuthorizationError, type Viewer } from "@/lib/authz";
import { cacheTags } from "@/lib/cache-tags";
import { parsePublishState, slugProblem } from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { sendPublicationReviewEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  importByArxiv,
  importByDoi,
  ImportError,
} from "@/lib/scholarly-import";
import { siteOrigin } from "@/lib/site-url";

const MAX_AUTHORS = 100;
const MAX_AREAS = 10;

function strings(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}

/** A calendar date, stored as midnight UTC, as the projects manager does. */
function optionalDate(formData: FormData, name: string, label: string) {
  const value = field(formData, name).trim();
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  const date = match
    ? new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      )
    : null;
  if (!date || date.toISOString().slice(0, 10) !== value) {
    throw new AdminActionError(`Enter a valid ${label}.`);
  }
  return date;
}

function optionalYear(formData: FormData): number | null {
  const value = field(formData, "year").trim();
  if (!value) return null;
  const year = Number(value);
  const limit = new Date().getUTCFullYear() + 5;
  if (!Number.isInteger(year) || year < 1900 || year > limit) {
    throw new AdminActionError(`Enter a year between 1900 and ${limit}.`);
  }
  return year;
}

/**
 * An identifier as it is written down, tidied. A pasted doi.org or arXiv
 * address is accepted: retyping an identifier is how they get mistyped.
 */
function optionalIdentifier(
  formData: FormData,
  name: "doi" | "arxivId",
): string | null {
  const value = field(formData, name).trim();
  if (!value) return null;
  const normalize =
    name === "doi"
      ? (input: string) =>
          input
            .replace(/^https?:\/\/(dx\.)?doi\.org\//iu, "")
            .replace(/^doi:\s*/iu, "")
      : (input: string) =>
          input
            .replace(/^https?:\/\/(www\.)?arxiv\.org\/(abs|pdf)\//iu, "")
            .replace(/\.pdf$/iu, "")
            .replace(/^arxiv:\s*/iu, "");
  const identifier = normalize(value).trim();

  if (name === "doi" && !/^10\.\d{4,9}\/\S{1,300}$/u.test(identifier)) {
    throw new AdminActionError("A DOI looks like 10.1038/nature14539.");
  }
  if (
    name === "arxivId" &&
    !/^\d{4}\.\d{4,5}(v\d+)?$/u.test(identifier) &&
    !/^[a-z-]+(\.[a-z]{2})?\/\d{7}(v\d+)?$/iu.test(identifier)
  ) {
    throw new AdminActionError("An arXiv id looks like 1706.03762.");
  }
  return identifier;
}

export type AuthorRow = {
  position: number;
  memberId: string | null;
  externalName: string | null;
  externalAffiliation: string | null;
  equalContribution: boolean;
  corresponding: boolean;
};

/**
 * The author list, in the order it was submitted. Each author is either a
 * member or a name typed in, never both: two records for one person is how
 * an author list starts disagreeing with itself.
 */
function readAuthors(formData: FormData): AuthorRow[] {
  const memberIds = strings(formData, "authors.memberId");
  const names = strings(formData, "authors.externalName");
  const affiliations = strings(formData, "authors.externalAffiliation");
  const equal = strings(formData, "authors.equalContribution");
  const corresponding = strings(formData, "authors.corresponding");

  if (memberIds.length > MAX_AUTHORS) {
    throw new AdminActionError(`List at most ${MAX_AUTHORS} authors.`);
  }

  const seen = new Set<string>();
  return memberIds.map((memberId, position) => {
    const externalName = (names[position] ?? "").trim();
    if (memberId && externalName) {
      throw new AdminActionError(
        `Author ${position + 1} is both a member and a typed name. Choose one.`,
      );
    }
    if (!memberId && !externalName) {
      throw new AdminActionError(
        `Choose a member or type a name for author ${position + 1}.`,
      );
    }
    if (memberId) {
      if (seen.has(memberId)) {
        throw new AdminActionError("Each member can appear once as an author.");
      }
      seen.add(memberId);
    }
    if (externalName.length > 200) {
      throw new AdminActionError("Keep each author name under 200 characters.");
    }
    const affiliation = (affiliations[position] ?? "").trim();
    if (affiliation.length > 200) {
      throw new AdminActionError("Keep each affiliation under 200 characters.");
    }

    return {
      position,
      memberId: memberId || null,
      externalName: externalName || null,
      externalAffiliation: affiliation || null,
      equalContribution: equal[position] === "yes",
      corresponding: corresponding[position] === "yes",
    };
  });
}

async function readPublication(formData: FormData) {
  const title = requiredText(formData, "title", "a title", 300);
  const slug = field(formData, "slug").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) throw new AdminActionError(slugIssue);

  const type = parsePublicationType(field(formData, "type"));
  if (!type) throw new AdminActionError("Choose a publication type.");
  const stage = parsePublicationStage(field(formData, "stage"));
  if (!stage) throw new AdminActionError("Choose a stage.");
  const state = parsePublishState(field(formData, "state"));
  if (!state) throw new AdminActionError("Choose a state.");
  if (state === "SCHEDULED") {
    throw new AdminActionError("Publications are not scheduled; publish them.");
  }

  const abstract = requiredText(formData, "abstract", "an abstract", 10_000);
  const authors = readAuthors(formData);
  if (authors.length === 0) throw new AdminActionError("Add at least one author.");

  const areaIds = [...new Set(strings(formData, "areaIds"))].filter(Boolean);
  if (areaIds.length > MAX_AREAS) {
    throw new AdminActionError(`Choose at most ${MAX_AREAS} research areas.`);
  }

  const projectId = field(formData, "projectId") || null;
  const db = getDb();
  const memberIds = authors
    .map((author) => author.memberId)
    .filter((id): id is string => Boolean(id));
  const [areaCount, memberCount, projectCount] = await Promise.all([
    db.researchArea.count({ where: { id: { in: areaIds } } }),
    db.member.count({ where: { id: { in: memberIds } } }),
    projectId ? db.project.count({ where: { id: projectId } }) : 1,
  ]);
  if (
    areaCount !== areaIds.length ||
    memberCount !== new Set(memberIds).size ||
    projectCount !== 1
  ) {
    throw new AdminActionError(
      "Something this publication links to no longer exists. Reload and try again.",
    );
  }

  return {
    data: {
      title,
      slug,
      abstract,
      type,
      stage,
      state,
      venueName: optionalText(formData, "venueName", "the venue", 300),
      venueShort: optionalText(formData, "venueShort", "the short venue", 80),
      year: optionalYear(formData),
      publishedAt: optionalDate(formData, "publishedAt", "publication date"),
      doi: optionalIdentifier(formData, "doi"),
      arxivId: optionalIdentifier(formData, "arxivId"),
      pdfUrl: optionalHttpsUrl(formData, "pdfUrl", "The PDF link"),
      codeUrl: optionalHttpsUrl(formData, "codeUrl", "The code link"),
      datasetUrl: optionalHttpsUrl(formData, "datasetUrl", "The dataset link"),
      pageUrl: optionalHttpsUrl(formData, "pageUrl", "The page link"),
      bibtexOverride: optionalText(
        formData,
        "bibtexOverride",
        "the BibTeX entry",
        5000,
      ),
      award: optionalText(formData, "award", "the award", 200),
      featured: checkbox(formData, "featured"),
      projectId,
    },
    authors,
    areaIds,
  };
}

/** Which unique field a conflict was about, so the message can name it. */
function conflictMessage(error: unknown): string | null {
  if (!isUniqueConflict(error)) return null;
  const named = uniqueConflictTarget(error);
  if (named.includes("doi")) {
    return "Another publication already has that DOI.";
  }
  if (named.includes("arxiv")) {
    return "Another publication already has that arXiv id.";
  }
  if (named.includes("slug")) {
    return "Another publication already uses that address. Choose a different one.";
  }
  return "That publication conflicts with an existing one.";
}

/** Everyone who can record a review, for the internal-review notice. */
async function reviewerAddresses(): Promise<string[]> {
  const users = await getDb().user.findMany({
    where: {
      role: { in: ["OWNER", "ADMIN", "REVIEWER"] },
      member: { status: "ACTIVE" },
    },
    select: { email: true },
  });
  return users.map((user) => user.email);
}

function notifyReviewers(id: string, title: string, viewer: Viewer): void {
  after(async () => {
    try {
      const to = await reviewerAddresses();
      if (to.length === 0) return;
      const origin = await siteOrigin();
      await sendPublicationReviewEmail({
        to,
        title,
        url: `${origin}/admin/publications/${id}`,
        movedBy: viewer.member?.name ?? viewer.name,
      });
    } catch (error) {
      // The save already succeeded; a notice that did not go out is logged,
      // never surfaced as a failure to the person who saved.
      console.error("[publications] review notice failed:", error);
    }
  });
}

export async function savePublicationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  let createdId: string | null = null;

  const result = await runAdminAction("publications:publish", async (viewer) => {
    const { data, authors, areaIds } = await readPublication(formData);
    const db = getDb();
    let enteredReview = false;

    try {
      if (!id) {
        const created = await db.$transaction(async (transaction) => {
          const publication = await transaction.publication.create({
            data: {
              ...data,
              authors: { create: authors },
              areas: { create: areaIds.map((areaId) => ({ areaId })) },
            },
            select: { id: true },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "publication.create",
            entity: "Publication",
            entityId: publication.id,
            diff: { title: data.title, stage: data.stage, state: data.state },
          });
          return publication;
        });
        createdId = created.id;
        enteredReview = data.stage === "INTERNAL_REVIEW";
      } else {
        const before = await db.publication.findUnique({
          where: { id },
          select: {
            title: true,
            slug: true,
            abstract: true,
            type: true,
            stage: true,
            state: true,
            venueName: true,
            venueShort: true,
            year: true,
            publishedAt: true,
            doi: true,
            arxivId: true,
            pdfUrl: true,
            codeUrl: true,
            datasetUrl: true,
            pageUrl: true,
            bibtexOverride: true,
            award: true,
            featured: true,
            projectId: true,
            authors: {
              orderBy: { position: "asc" },
              select: {
                memberId: true,
                externalName: true,
                externalAffiliation: true,
                equalContribution: true,
                corresponding: true,
              },
            },
            areas: { select: { areaId: true } },
          },
        });
        if (!before) {
          throw new AdminActionError("That publication no longer exists.");
        }

        const diff = changes(
          {
            ...before,
            areaIds: before.areas.map((area) => area.areaId).sort(),
            authors: before.authors,
          },
          {
            ...data,
            areaIds: [...areaIds].sort(),
            // Position is the array order on both sides, so comparing it
            // would only ever repeat what the order already says.
            authors: authors.map((author) => ({
              memberId: author.memberId,
              externalName: author.externalName,
              externalAffiliation: author.externalAffiliation,
              equalContribution: author.equalContribution,
              corresponding: author.corresponding,
            })),
          },
          ["abstract", "bibtexOverride"],
        );
        if (Object.keys(diff).length === 0) {
          return { status: "success", message: "Nothing changed." };
        }

        await db.$transaction(async (transaction) => {
          await transaction.publication.update({
            where: { id },
            data: {
              ...data,
              authors: { deleteMany: {}, create: authors },
              areas: {
                deleteMany: {},
                create: areaIds.map((areaId) => ({ areaId })),
              },
            },
          });
          await recordAudit(transaction, {
            actorId: viewer.userId,
            action: "publication.update",
            entity: "Publication",
            entityId: id,
            diff: diff as Prisma.InputJsonValue,
          });
        });
        enteredReview =
          data.stage === "INTERNAL_REVIEW" && before.stage !== "INTERNAL_REVIEW";
      }
    } catch (error) {
      const message = conflictMessage(error);
      if (message) throw new AdminActionError(message);
      throw error;
    }

    if (enteredReview) {
      notifyReviewers(createdId ?? id, data.title, viewer);
    }
    invalidate(cacheTags.publications);
    return { status: "success", message: "Saved." };
  });

  revalidatePath("/admin/publications");
  if (createdId) redirect(`/admin/publications/${createdId}?created=1`);
  if (id) revalidatePath(`/admin/publications/${id}`);
  return result;
}

export async function bulkPublicationsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAdminAction("publications:publish", async (viewer) => {
    const outcome = await runBulk(viewer, formData, {
      entity: "Publication",
      prefix: "publication",
      noun: { one: "publication", many: "publications" },
      load: (ids) =>
        getDb().publication.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            state: true,
            _count: { select: { resources: true, newsPosts: true } },
          },
        }),
      // Deleting would unlink a resource or a news post from its paper.
      keep: (row) =>
        row._count.resources + row._count.newsPosts > 0
          ? "it is linked from a resource or a news post: archive it instead"
          : null,
      update: (transaction, id, data) =>
        transaction.publication.update({ where: { id }, data }),
      remove: (transaction, id) =>
        transaction.publication.delete({ where: { id } }),
    });
    invalidate(cacheTags.publications);
    return outcome;
  });
  revalidatePath("/admin/publications");
  return result;
}

/** A reviewer's decision and comment, kept with the publication. */
export async function reviewPublicationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "publicationId");

  const result = await runAdminAction("publications:publish", async (viewer) => {
    const decision = parseReviewDecision(field(formData, "decision"));
    if (!decision) throw new AdminActionError("Choose approve or reject.");
    const comment = requiredText(formData, "comment", "a comment", 4000);
    if (!viewer.member) {
      throw new AdminActionError(
        "Recording a review needs a lab profile on your account.",
      );
    }

    const db = getDb();
    const publication = await db.publication.findUnique({
      where: { id },
      select: { id: true, stage: true },
    });
    if (!publication) {
      throw new AdminActionError("That publication no longer exists.");
    }

    await db.$transaction(async (transaction) => {
      const review = await transaction.publicationReview.create({
        data: {
          publicationId: id,
          reviewerId: viewer.member!.id,
          comment,
          decision,
        },
        select: { id: true },
      });
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: "publication.review",
        entity: "Publication",
        entityId: id,
        diff: { decision, reviewId: review.id },
      });
    });

    return {
      status: "success",
      // The stage is not moved here: making a paper public stays a separate,
      // deliberate act by an editor.
      message:
        decision === "APPROVED"
          ? "Approved. Move the stage on when you are ready."
          : "Rejected. The comment is on the record.",
    };
  });

  revalidatePath(`/admin/publications/${id}`);
  return result;
}

/**
 * Fills the editor from a DOI or an arXiv id. It reaches only Crossref and
 * arXiv, needs the publishing capability, and is limited per person so the
 * lab is never the source of a burst of lookups.
 */
export async function importPublicationAction(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  let viewer: Viewer;
  try {
    viewer = await authorize("publications:publish");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const source = field(formData, "source");
  const value = field(formData, "identifier").trim();
  if (!value || value.length > 300) {
    return { status: "error", message: "Enter a DOI or an arXiv id." };
  }

  try {
    const decision = await checkRateLimit({
      scope: "publication-import",
      identifier: createHash("sha256")
        .update(viewer.userId)
        .digest("hex")
        .slice(0, 32),
      limit: 30,
      windowSeconds: 10 * 60,
    });
    if (!decision.allowed) {
      return {
        status: "error",
        message: "Too many lookups. Wait a few minutes and try again.",
      };
    }

    return {
      status: "ready",
      publication:
        source === "arxiv"
          ? await importByArxiv(value)
          : await importByDoi(value),
    };
  } catch (error) {
    if (error instanceof ImportError) {
      return { status: "error", message: error.message };
    }
    console.error("[publications] import failed:", error);
    return {
      status: "error",
      message: "That lookup could not be completed. Try again shortly.",
    };
  }
}
