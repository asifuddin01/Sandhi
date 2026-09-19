import { apiRoute } from "@/lib/api/handler";
import { getMemberProjects } from "@/lib/portal-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The viewer's own projects, drafts included. */
export const GET = apiRoute(
  { auth: true, requireClient: false },
  async ({ viewer }) => ({ projects: await getMemberProjects(viewer!) }),
);
