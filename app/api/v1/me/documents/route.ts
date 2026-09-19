import { apiRoute } from "@/lib/api/handler";
import { param } from "@/lib/api/public";
import { getMemberDocuments } from "@/lib/portal-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Documents on the viewer's own projects. Private files come back as links
 * that expire, so nothing here can be forwarded for long.
 */
export const GET = apiRoute(
  { auth: true, requireClient: false },
  async ({ viewer, searchParams }) => ({
    documents: await getMemberDocuments(viewer!, {
      projectSlug: param(searchParams, "project", 200),
    }),
  }),
);
