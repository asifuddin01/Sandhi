import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventDetail } from "@/components/events/EventDetail";
import { getPublicEventBySlug } from "@/lib/public-events";
import { isSectionEnabled } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function metaDescription(value: string): string {
  const text = value.replace(/\s+/gu, " ").trim();
  return text.length > 158 ? `${text.slice(0, 155)}…` : text;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = (await isSectionEnabled("events"))
    ? await getPublicEventBySlug(slug)
    : null;
  if (!event) {
    return {
      title: "Event not found",
      robots: { index: false, follow: false },
    };
  }

  const description = metaDescription(event.abstract);
  return {
    title: event.title,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      title: `${event.title} | SANDHI Research Lab`,
      description,
      url: `/events/${event.slug}`,
      type: "website",
    },
  };
}

export default async function EventPage({ params }: PageProps) {
  if (!(await isSectionEnabled("events"))) notFound();
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug);
  if (!event) notFound();
  return <EventDetail event={event} />;
}
