import { assertEmailConfigured, sendApplicationEmails } from "@/lib/email";
import {
  cleanOptional,
  flattenZodErrors,
  joinSubmissionSchema,
  requiresProposal,
} from "@/lib/forms";
import { getContactAddresses } from "@/lib/forms-contact";
import {
  rateLimitResponse,
  readJson,
  serviceErrorResponse,
} from "@/lib/forms-http";
import { requestIdentifier, requestIp } from "@/lib/forms-services";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/ratelimit";
import { assertPrivateUploadExists } from "@/lib/storage";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit({
      scope: "join-submit",
      identifier: requestIdentifier(request),
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return Response.json(
        { message: "Send a valid application." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const parsed = joinSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          message: "Please check the highlighted fields.",
          errors: flattenZodErrors(parsed.error),
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = parsed.data;
    const turnstile = await verifyTurnstile({
      token: data.turnstileToken,
      remoteIp: requestIp(request),
    });
    if (!turnstile.success) {
      return Response.json(
        {
          message: "The anti-spam check was not accepted. Please try again.",
          errors: { turnstileToken: "Complete the anti-spam check again." },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!isDatabaseConfigured()) {
      return Response.json(
        { message: "Applications are temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    assertEmailConfigured();
    await Promise.all([
      data.cvKey && data.cvUploadToken
        ? assertPrivateUploadExists({
            key: data.cvKey,
            kind: "cv",
            uploadToken: data.cvUploadToken,
          })
        : Promise.resolve(),
      data.proposalKey && data.proposalUploadToken
        ? assertPrivateUploadExists({
            key: data.proposalKey,
            kind: "proposal",
            uploadToken: data.proposalUploadToken,
          })
        : Promise.resolve(),
    ]);

    const db = getDb();
    let opportunityId: string | null = null;
    if (data.opportunitySlug) {
      const opportunity = await db.opportunity.findFirst({
        where: {
          slug: data.opportunitySlug,
          state: "PUBLISHED",
          OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
        },
        select: { id: true },
      });
      if (!opportunity) {
        return Response.json(
          {
            message: "That opportunity is no longer open.",
            errors: {
              opportunitySlug: "Choose an open opportunity or apply generally.",
            },
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      opportunityId = opportunity.id;
    }

    const includeProposal = requiresProposal(data.type);
    const application = await db.application.create({
      data: {
        type: data.type,
        name: data.name,
        email: data.email.toLowerCase(),
        phone: cleanOptional(data.phone),
        institution: data.institution,
        currentRole: data.currentRole,
        interests: data.interests,
        scholarUrl: cleanOptional(data.scholarUrl),
        orcid: cleanOptional(data.orcid),
        githubUrl: cleanOptional(data.githubUrl),
        linkedinUrl: cleanOptional(data.linkedinUrl),
        websiteUrl: cleanOptional(data.websiteUrl),
        cvKey: data.cvKey ?? null,
        motivation: data.motivation,
        experience: cleanOptional(data.experience),
        proposalTitle: includeProposal
          ? cleanOptional(data.proposalTitle)
          : null,
        proposalSummary: includeProposal
          ? cleanOptional(data.proposalSummary)
          : null,
        proposalKey: includeProposal ? (data.proposalKey ?? null) : null,
        hoursPerWeek:
          typeof data.hoursPerWeek === "number" ? data.hoursPerWeek : null,
        consent: data.consent,
        opportunityId,
      },
      select: { id: true },
    });

    const addresses = await getContactAddresses();
    const adminEmail =
      process.env.ADMIN_NOTIFY_EMAIL?.trim() || addresses.applications;
    let emailDelayed = false;

    try {
      await sendApplicationEmails({ ...data, id: application.id }, adminEmail);
    } catch (error) {
      emailDelayed = true;
      console.error(
        "Application email delivery failed after persistence.",
        error,
      );
      await db.auditLog
        .create({
          data: {
            action: "APPLICATION_EMAIL_FAILED",
            entity: "Application",
            entityId: application.id,
            diff: { delivery: "delayed" },
          },
        })
        .catch(() => undefined);
    }

    return Response.json(
      {
        message:
          "Application received. We read every application and will reply by email.",
        emailDelayed,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return (
      serviceErrorResponse(error) ??
      Response.json(
        { message: "The application could not be sent. Please try again." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    );
  }
}
