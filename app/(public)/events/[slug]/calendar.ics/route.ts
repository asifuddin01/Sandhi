import { createEventCalendar } from "@/lib/event-calendar";
import { getPublicEventBySlug } from "@/lib/public-events";
import { isSectionEnabled } from "@/lib/site-settings";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const event = (await isSectionEnabled("events"))
    ? await getPublicEventBySlug(slug)
    : null;
  if (!event) return new Response("Event not found.", { status: 404 });

  const calendar = createEventCalendar(event);
  const filename = `${event.slug.replace(/[^a-z0-9-]/giu, "-")}.ics`;
  return new Response(calendar, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
