import { vi } from "vitest";

/**
 * `unstable_cache` needs Next's per-request incremental cache, which does not
 * exist outside a running server. Unit tests are checking what a query asks
 * the database for, not whether the answer was cached, so here the wrapper is
 * transparent. The caching itself is proved end to end, in
 * `tests/e2e/admin-resources-partners.spec.ts`: the public index is read
 * before a change and must show it afterwards.
 */
vi.mock("next/cache", async () => {
  const actual =
    await vi.importActual<typeof import("next/cache")>("next/cache");
  return {
    ...actual,
    unstable_cache: <Args extends unknown[], Result>(
      read: (...args: Args) => Promise<Result>,
    ) => read,
  };
});
