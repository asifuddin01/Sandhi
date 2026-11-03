"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

function filterPrivateAnalyticsEvents(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  const pathname = new URL(event.url, window.location.origin).pathname;
  return /^\/(?:portal|admin)(?:\/|$)/u.test(pathname) ? null : event;
}

export function WebAnalytics() {
  return <Analytics beforeSend={filterPrivateAnalyticsEvents} />;
}
