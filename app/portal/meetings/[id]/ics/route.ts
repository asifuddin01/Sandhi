import { getViewer } from "@/lib/authz";
import { toIcs } from "@/lib/ics";
import { getMemberMeeting } from "@/lib/portal/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gone() {
  // The same answer whether the meeting never existed or belongs to a
  // project this reader is not on.
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * One meeting as a calendar file, so it can go in somebody's own diary
 * rather than living only on this page. Visibility is `getMemberMeeting`'s
 * decision: the same rule the meeting's page is drawn by.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return gone();

  const meeting = await getMemberMeeting(viewer, id);
  if (!meeting) return gone();

  const body = toIcs({
    uid: `meeting-${meeting.id}@sandhi.research`,
    start: meeting.startsAt,
    end: meeting.endsAt,
    title: meeting.title,
    description: meeting.agenda,
    url: meeting.link,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sandhi-meeting.ics"',
      // Somebody's diary is nobody else's: never a shared cache.
      "Cache-Control": "no-store",
    },
  });
}
