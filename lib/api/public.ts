import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { CachePolicy } from "@/lib/api/respond";
import { isSectionEnabled } from "@/lib/site-settings";

/**
 * Public reads may be held briefly, as `/api/graph` and `/api/search` already
 * are. It has to stay short: scheduled news and closing opportunities become
 * public by the clock, and the cache must not hold yesterday's answer.
 */
export const PUBLIC_CACHE: CachePolicy = {
  maxAge: 60,
  staleWhileRevalidate: 300,
};

/** Sections switched off in settings are absent from the API too, not just hidden. */
export async function requireSection(
  section: "events" | "partners",
): Promise<void> {
  if (!(await isSectionEnabled(section))) throw ApiError.notFound();
}

/** A query value, trimmed and length-capped, or undefined when absent. */
export function param(
  searchParams: URLSearchParams,
  name: string,
  max = 120,
): string | undefined {
  const value = searchParams.get(name)?.trim();
  return value ? value.slice(0, max) : undefined;
}
