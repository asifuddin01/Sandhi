"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { authorize, AuthorizationError } from "@/lib/authz";
import { slugProblem, slugify } from "@/lib/content-state";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { sendPublicationReviewEmail } from "@/lib/email";
import { workspaceMemberId } from "@/lib/portal-content";
import { memberMayEdit, memberMaySubmit } from "@/lib/portal/publications";
import { readAuthorRows } from "@/lib/publication-authors";
import { parsePublicationType } from "@/lib/publications";
import { siteOrigin } from "@/lib/site-url";

export type PublicationFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

/** A refusal whose message is safe to show the member who caused it. */
class PublicationError extends Error {}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalUrl(formData: FormData, name: string): string | null {
  const value = field(formData, name).trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new PublicationError("Links need a full https:// address.");
    }
    return url.toString();
  } catch (error) {
    if (error instanceof PublicationError) throw error;
    throw new PublicationError("Links need a full https:// address.");
  }
}

/**
 * Runs one of a member's own publication actions: authorizes, then turns an
 * expected refusal into a message and anything else into a generic one, with
 * the detail logged rather than shown.
 */
async function run(
  work: (memberId: string, userId: string) => Promise<PublicationFormState>,
): Promise<PublicationFormState> {
  let memberId: string | null;
  let userId: string;
  try {
    const viewer = await authorize("portal:access");
    memberId = workspaceMemberId(viewer);
    userId = viewer.userId;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  if (!memberId || !isDatabaseConfigured()) {
    return {
      status: "error",
      message: "Your account is not linked to a profile yet.",
    };
  }

  try {
    return await work(memberId, userId);
  } catch (error) {
    if (error instanceof PublicationError) {
      return { status: "error", message: error.message };
    }
    console.error("[portal] publication action failed:", error);
    return {
      status: "error",
      message: "That could not be saved. Please try again.",
    };
  }
}

/** What a member may set. Stage, state, areas and featuring are not here. */
function readForm(formData: FormData) {
  const title = field(formData, "title").trim();
  if (title.length < 3 || title.length > 300) {
    throw new PublicationError("Give the paper its full title.");
  }
  const abstract = field(formData, "abstract").trim();
  if (abstract.length < 10) {
    throw new PublicationError("Paste the abstract.");
  }
  const type = parsePublicationType(field(formData, "type"));
  if (!type) throw new PublicationError("Choose what kind of paper it is.");

  const yearText = field(formData, "year").trim();
  const year = yearText ? Number(yearText) : null;
  if (
    year !== null &&
    (!Number.isInteger(year) || year < 1900 || year > 2100)
  ) {
    throw new PublicationError("Enter the year as four digits.");
  }

  const authors = readAuthorRows(
    formData,
    (message) => new PublicationError(message),
  );
  if (authors.length === 0) {
    throw new PublicationError("List at least one author.");
  }

  return {
    title,
    abstract,
    type,
    year,
    venueName: field(formData, "venueName").trim() || null,
    venueShort: field(formData, "venueShort").trim() || null,
    doi: field(formData, "doi").trim() || null,
    arxivId: field(formData, "arxivId").trim() || null,
    pdfUrl: optionalUrl(formData, "pdfUrl"),
    codeUrl: optionalUrl(formData, "codeUrl"),
    datasetUrl: optionalUrl(formData, "datasetUrl"),
    pageUrl: optionalUrl(formData, "pageUrl"),
    authors,
  };
}

function conflict(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (!message.includes("Unique constraint")) return null;
  if (message.includes("doi")) return "That DOI is already recorded.";
  if (message.includes("arxivId")) return "That arXiv id is already recorded.";
  if (message.includes("slug")) {
    return "A paper with that title is already recorded.";
  }
  return "Something about this paper is already recorded.";
}

export async function saveMemberPublicationAction(
  _previous: PublicationFormState,
  formData: FormData,
): Promise<PublicationFormState> {
  const id = field(formData, "id").trim();
  let created: string | null = null;

  const result = await run(async (memberId) => {
    const data = readForm(formData);
    // Whoever records it is on the author list, whether or not they
    // remembered to add themselves: a paper nobody in the lab is on would be
    // invisible to its own author the moment it was saved.
    const authors = data.authors.some((author) => author.memberId === memberId)
      ? data.authors
      : [
          ...data.authors,
          {
            position: data.authors.length,
            memberId,
            externalName: null,
            externalAffiliation: null,
            equalContribution: false,
            corresponding: false,
          },
        ];

    const db = getDb();
    if (id) {
      const existing = await db.publication.findFirst({
        where: { id, authors: { some: { memberId } } },
        select: { stage: true },
      });
      if (!existing) throw new PublicationError("That paper is not yours.");
      if (!memberMayEdit(existing.stage)) {
        throw new PublicationError(
          "This is with the reviewers now. Ask them for a change.",
        );
      }
    }

    // `authors` is written separately, as rows of its own.
    const fields = {
      title: data.title,
      abstract: data.abstract,
      type: data.type,
      year: data.year,
      venueName: data.venueName,
      venueShort: data.venueShort,
      doi: data.doi,
      arxivId: data.arxivId,
      pdfUrl: data.pdfUrl,
      codeUrl: data.codeUrl,
      datasetUrl: data.datasetUrl,
      pageUrl: data.pageUrl,
    };
    try {
      if (id) {
        await db.$transaction(async (transaction) => {
          await transaction.publication.update({
            where: { id },
            data: fields,
          });
          await transaction.publicationAuthor.deleteMany({
            where: { publicationId: id },
          });
          await transaction.publicationAuthor.createMany({
            data: authors.map((author) => ({ ...author, publicationId: id })),
          });
        });
        return { status: "success", message: "Saved." };
      }

      const slug = slugify(fields.title).slice(0, 80);
      const problem = slugProblem(slug);
      if (problem) throw new PublicationError(problem);

      const publication = await db.publication.create({
        data: {
          ...fields,
          slug,
          // A member records a draft. Publishing is somebody else's decision.
          stage: "DRAFT",
          state: "DRAFT",
          authors: { create: authors },
        },
        select: { id: true },
      });
      created = publication.id;
      return { status: "success", message: "Recorded as a draft." };
    } catch (error) {
      const message = conflict(error);
      if (message) throw new PublicationError(message);
      throw error;
    }
  });

  revalidatePath("/portal/publications");
  if (id) revalidatePath(`/portal/publications/${id}`);
  if (created) redirect(`/portal/publications/${created}`);
  return result;
}

export async function submitPublicationForReviewAction(
  _previous: PublicationFormState,
  formData: FormData,
): Promise<PublicationFormState> {
  const id = field(formData, "id").trim();

  const result = await run(async (memberId) => {
    const db = getDb();
    const publication = await db.publication.findFirst({
      where: { id, authors: { some: { memberId } } },
      select: { id: true, title: true, stage: true },
    });
    if (!publication) throw new PublicationError("That paper is not yours.");
    if (!memberMaySubmit(publication.stage)) {
      throw new PublicationError("This has already gone to the reviewers.");
    }

    await db.publication.update({
      where: { id },
      data: { stage: "INTERNAL_REVIEW" },
    });

    // The same notice the administration manager sends, so a paper reaches
    // the reviewers the same way whoever moved it.
    after(async () => {
      try {
        const users = await getDb().user.findMany({
          where: {
            role: { in: ["OWNER", "ADMIN", "REVIEWER"] },
            member: { status: "ACTIVE" },
          },
          select: { email: true },
        });
        const to = users.map((user) => user.email);
        if (to.length === 0) return;
        const author = await getDb().member.findUnique({
          where: { id: memberId },
          select: { name: true },
        });
        const origin = await siteOrigin();
        await sendPublicationReviewEmail({
          to,
          title: publication.title,
          url: `${origin}/admin/publications/${publication.id}`,
          movedBy: author?.name ?? "A member",
        });
      } catch (error) {
        // The move already succeeded; a notice that did not go out is
        // logged, never shown as a failure to the person who sent it.
        console.error("[portal] review notice failed:", error);
      }
    });

    return {
      status: "success",
      message: "Sent for internal review.",
    };
  });

  revalidatePath("/portal/publications");
  revalidatePath(`/portal/publications/${id}`);
  revalidatePath("/admin/publications");
  return result;
}
