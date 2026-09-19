import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { workspaceMemberId } from "@/lib/portal-content";
import {
  createPrivateDownloadUrl,
  PRIVATE_DOWNLOAD_SECONDS,
} from "@/lib/storage";
import { publicProjectWhere } from "@/lib/visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gone() {
  // The same answer whether the file never existed, was withdrawn, or belongs
  // to a project this reader cannot see: the URL tells them nothing either way.
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * One file attached to a progress update. Attachments live in private
 * storage, so this route is the authorization decision and the signed link is
 * its last step: public when the update and its project are both published,
 * otherwise only for someone on that project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isDatabaseConfigured()) return gone();

  const attachment = await getDb().updateAttachment.findUnique({
    where: { id },
    select: {
      fileKey: true,
      contentType: true,
      update: {
        select: {
          isPublic: true,
          projectId: true,
          project: { select: { state: true } },
        },
      },
    },
  });
  if (!attachment) return gone();

  const readableByAnyone =
    attachment.update.isPublic &&
    attachment.update.project.state === publicProjectWhere.state;

  if (!readableByAnyone) {
    const viewer = await getViewer();
    const memberId = viewer ? workspaceMemberId(viewer) : null;
    if (!memberId) return gone();
    const onProject = await getDb().projectMember.findUnique({
      where: {
        projectId_memberId: {
          projectId: attachment.update.projectId,
          memberId,
        },
      },
      select: { memberId: true },
    });
    if (!onProject) return gone();
  }

  let url: string;
  try {
    url = createPrivateDownloadUrl(attachment.fileKey);
  } catch {
    // Storage is not configured (or is misconfigured). A reader who is
    // allowed the file still gets an answer, not a stack trace.
    return new Response("This file cannot be served right now.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      // Shorter than the signature, and never shared between readers: a
      // published file is still resolved per request, so withdrawing it
      // stops working links quickly.
      "Cache-Control": readableByAnyone
        ? `private, max-age=${Math.floor(PRIVATE_DOWNLOAD_SECONDS / 2)}`
        : "no-store",
      Vary: "Cookie",
    },
  });
}
