import { isApplicationFileKind } from "@/lib/applications";
import { getViewer } from "@/lib/authz";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { can } from "@/lib/permissions";
import { createPrivateDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gone() {
  // The same answer whether the application never existed, carries no such
  // file, or is simply none of this reader's business.
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * An applicant's CV or proposal PDF. These are the most private things the
 * site holds — somebody's employment history, sent to a lab they hope will
 * read it — so the object sits in private storage and this route is the
 * authorization decision. The signed link is its last step, lives ten
 * minutes, and is never cached or shared between readers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await params;
  if (!isApplicationFileKind(kind) || !isDatabaseConfigured()) return gone();

  const viewer = await getViewer();
  if (!viewer || !can(viewer.role, "applications:manage")) return gone();
  // A second factor is required of everyone, but an account that has not set
  // one up yet must not reach these while it waits.
  if (!viewer.secondFactor) return gone();

  const application = await getDb().application.findUnique({
    where: { id },
    select: { cvKey: true, proposalKey: true },
  });
  const key = kind === "cv" ? application?.cvKey : application?.proposalKey;
  if (!key) return gone();

  let url: string;
  try {
    url = createPrivateDownloadUrl(key);
  } catch {
    // Storage is not configured. A reader who is allowed the file still gets
    // an answer rather than a stack trace.
    return new Response("This file cannot be served right now.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
      Vary: "Cookie",
      "Referrer-Policy": "no-referrer",
    },
  });
}
