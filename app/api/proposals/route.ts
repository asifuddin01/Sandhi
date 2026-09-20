import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { slugify } from "@/lib/content-state";
import { flattenZodErrors, proposalSubmissionSchema } from "@/lib/forms";
import {
  crossSiteResponse,
  isSameOriginRequest,
  rateLimitResponse,
  readJson,
  serviceErrorResponse,
} from "@/lib/forms-http";
import { requestIdentifier, requestIp } from "@/lib/forms-services";
import { workspaceMemberId } from "@/lib/portal-content";
import { checkRateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { publicAreaWhere } from "@/lib/visibility";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function refuse(message: string, status: number, errors?: unknown) {
  return Response.json(errors ? { message, errors } : { message }, {
    status,
    headers: NO_STORE,
  });
}

/**
 * A free slug for a proposal. Two people may send in the same idea on the
 * same day, so the address is settled here rather than trusted to be unique.
 */
async function freeSlug(title: string): Promise<string> {
  const base = slugify(title) || "proposal";
  const taken = await getDb().proposal.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  if (!taken.some((row) => row.slug === base)) return base;

  const used = new Set(taken.map((row) => row.slug));
  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * A research proposal from anyone: a member, a student, a colleague at
 * another lab. It is treated like the other public forms — same origin, rate
 * limited, behind the anti-spam check — and a member's identity comes from
 * their session, never from the fields they filled in.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return crossSiteResponse("This proposal was not accepted.");
    }

    const rateLimit = await checkRateLimit({
      scope: "proposal-submit",
      identifier: requestIdentifier(request),
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return refuse("Send a valid proposal.", 400);
    }

    const parsed = proposalSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      return refuse(
        "Please check the highlighted fields.",
        400,
        flattenZodErrors(parsed.error),
      );
    }
    const data = parsed.data;

    const turnstile = await verifyTurnstile({
      token: data.turnstileToken,
      remoteIp: requestIp(request),
    });
    if (!turnstile.success) {
      return refuse(
        "The anti-spam check was not accepted. Please try again.",
        400,
        {
          turnstileToken: "Complete the anti-spam check again.",
        },
      );
    }

    if (!isDatabaseConfigured()) {
      return refuse("Proposals are temporarily unavailable.", 503);
    }

    const db = getDb();
    let areaId: string | null = null;
    if (data.areaSlug) {
      const area = await db.researchArea.findFirst({
        where: { slug: data.areaSlug, ...publicAreaWhere },
        select: { id: true },
      });
      if (!area) {
        return refuse("Choose a research area from the list.", 400, {
          areaSlug: "That research area is not one of ours.",
        });
      }
      areaId = area.id;
    }

    // A signed-in member is credited from their session. Someone outside the
    // lab has no profile, so their name and address stay on the proposal.
    const viewer = await getViewer();
    const proposerId = viewer ? workspaceMemberId(viewer) : null;

    const proposal = await db.proposal.create({
      data: {
        slug: await freeSlug(data.title),
        title: data.title,
        summary: data.summary,
        question: data.question,
        approach: data.approach || null,
        outcome: data.outcome || null,
        areaId,
        proposerId,
        proposerName: viewer?.member?.name ?? data.name,
        proposerEmail: (viewer?.email ?? data.email).toLowerCase(),
        proposerAffiliation: data.affiliation || null,
      },
      select: { slug: true },
    });

    return Response.json(
      { slug: proposal.slug },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    return (
      serviceErrorResponse(error) ??
      refuse("That proposal could not be sent.", 500)
    );
  }
}
