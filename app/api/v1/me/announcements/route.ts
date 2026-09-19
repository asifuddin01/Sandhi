import { apiRoute } from "@/lib/api/handler";
import { param } from "@/lib/api/public";
import {
  ANNOUNCEMENTS_PAGE_SIZE,
  getMemberAnnouncements,
} from "@/lib/portal-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: true, requireClient: false },
  async ({ viewer, searchParams }) => {
    const limit = Number.parseInt(param(searchParams, "limit", 4) ?? "", 10);
    const announcements = await getMemberAnnouncements(
      viewer!,
      Number.isInteger(limit) ? limit : ANNOUNCEMENTS_PAGE_SIZE,
    );
    return {
      announcements,
      unread: announcements.filter((item) => !item.read).length,
    };
  },
);
