import "server-only";

import { unstable_cache } from "next/cache";

import type { CacheTag } from "@/lib/cache-tags";

/**
 * How long a cached public read survives without anyone expiring it. Every
 * administrative mutation calls `invalidate()` and takes effect at once; this
 * is only the backstop, so a tag somebody forgot to expire costs minutes of
 * staleness rather than lasting until the next deploy.
 */
export const PUBLIC_CACHE_SECONDS = 300;

/**
 * Wraps a read of published data so it is computed once and shared, instead
 * of hitting Postgres on every request.
 *
 * Only for data that is the same for everybody. Nothing viewer-specific may
 * go through here: the entry is shared across requests and across people, so
 * anything keyed on a session would leak from one reader to the next.
 *
 * Nothing time-dependent may go through here either. A cached entry freezes
 * whatever `now` was when it was computed, so a query that asks
 * `publishAt <= now` would keep answering with the old moment. Cache the
 * published set and apply the clock afterwards — `isPublishedAndDue` and
 * `isOpportunityPublic` exist for exactly that.
 */
/**
 * `unstable_cache` stores its answer as JSON, so a `Date` comes back from a
 * warm cache as a string. The first request after a fill looks perfect and
 * every one after it calls `.toISOString()` on a string and throws — which
 * is exactly how this reached production once already, hidden because the
 * test data had no dated rows in it.
 *
 * So a cached read may not return a `Date` at all. Send an ISO string and
 * let the caller parse it: this turns a 500 that only appears with real
 * content into a compile error.
 */
export type CacheSafe<T> = T extends Date
  ? "A Date cannot be cached: return an ISO string instead"
  : T extends (infer Item)[]
    ? CacheSafe<Item>[]
    : T extends object
      ? { [Key in keyof T]: CacheSafe<T[Key]> }
      : T;

export function cachedPublicRead<Args extends unknown[], Result>(
  key: string,
  tags: readonly CacheTag[],
  read: (...args: Args) => Promise<Result & CacheSafe<Result>>,
): (...args: Args) => Promise<Result> {
  const cached = unstable_cache(read, [key], {
    tags: [...tags],
    revalidate: PUBLIC_CACHE_SECONDS,
  });
  return (...args: Args) => cached(...args);
}
