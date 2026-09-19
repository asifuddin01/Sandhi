import { apiRoute, found } from "@/lib/api/handler";
import { getMemberProfile } from "@/lib/portal-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The viewer's own lab profile, including the fields the public pages omit.
 * Editing arrives with the member portal (M6) as one shared action, so the
 * website and the app change a profile the same way.
 */
export const GET = apiRoute(
  { auth: true, requireClient: false },
  async ({ viewer }) =>
    found(
      await getMemberProfile(viewer!),
      "This account has no lab profile yet.",
    ),
);
