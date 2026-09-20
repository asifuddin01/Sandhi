import { getViewer } from "@/lib/authz";
import {
  crossSiteResponse,
  isSameOriginRequest,
  rateLimitResponse,
  readJson,
  serviceErrorResponse,
} from "@/lib/forms-http";
import { requestIdentifier } from "@/lib/forms-services";
import { workspaceMemberId } from "@/lib/portal-content";
import { portraitUploadSchema } from "@/lib/portal/profile-fields";
import { checkRateLimit } from "@/lib/ratelimit";
import { createPortraitUploadIntent } from "@/lib/storage";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function refuse(message: string, status: number) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/**
 * Somewhere to put one's own photograph. The key is built from the member id
 * on the session, never from the request, so the slot this hands back can
 * only ever be spent on the caller's own profile.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return crossSiteResponse("This upload was not accepted.");
    }

    const viewer = await getViewer();
    if (!viewer) return refuse("Sign in to add a photograph.", 401);
    const memberId = workspaceMemberId(viewer);
    if (!memberId) {
      return refuse("Your account is not linked to a profile yet.", 403);
    }

    const rateLimit = await checkRateLimit({
      scope: "portrait-upload",
      identifier: viewer.userId || requestIdentifier(request),
      limit: 20,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return refuse("Send valid JSON upload details.", 400);
    }

    const parsed = portraitUploadSchema.safeParse(raw);
    if (!parsed.success) {
      return refuse(
        parsed.error.issues[0]?.message ?? "That image cannot be used.",
        400,
      );
    }

    const intent = createPortraitUploadIntent({ memberId, ...parsed.data });
    return Response.json(intent, { status: 201, headers: NO_STORE });
  } catch (error) {
    return (
      serviceErrorResponse(error) ??
      refuse("The upload could not be prepared.", 500)
    );
  }
}
