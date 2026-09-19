import { getViewer } from "@/lib/authz";
import {
  crossSiteResponse,
  isSameOriginRequest,
  rateLimitResponse,
  readJson,
  serviceErrorResponse,
} from "@/lib/forms-http";
import { requestIdentifier } from "@/lib/forms-services";
import { onProject } from "@/lib/portal/progress";
import { checkRateLimit } from "@/lib/ratelimit";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { attachmentUploadSchema } from "@/lib/portal/attachment-input";
import { createAttachmentUploadIntent } from "@/lib/storage";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function refuse(message: string, status: number) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/**
 * An upload slot for a file a team is attaching to one of its own project
 * updates. The slot is minted only for a member who is on that project, so a
 * signed-in stranger cannot put objects in the lab's storage.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return crossSiteResponse("This upload was not accepted.");
    }

    const viewer = await getViewer();
    if (!viewer) return refuse("Sign in to attach a file.", 401);

    const rateLimit = await checkRateLimit({
      scope: "update-attachment",
      identifier: viewer.userId || requestIdentifier(request),
      limit: 60,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return refuse("Send valid JSON upload details.", 400);
    }

    const parsed = attachmentUploadSchema.safeParse(raw);
    if (!parsed.success) {
      return refuse(
        parsed.error.issues[0]?.message ?? "That file cannot be attached.",
        400,
      );
    }

    if (!isDatabaseConfigured()) {
      return refuse("Attachments are unavailable right now.", 503);
    }
    const project = await getDb().project.findUnique({
      where: { slug: parsed.data.projectSlug },
      select: { id: true },
    });
    if (!project || !(await onProject(viewer, project.id))) {
      return refuse("You are not on that project.", 403);
    }

    const intent = createAttachmentUploadIntent(parsed.data);
    return Response.json(intent, { status: 201, headers: NO_STORE });
  } catch (error) {
    return (
      serviceErrorResponse(error) ??
      refuse("The upload could not be prepared.", 500)
    );
  }
}
