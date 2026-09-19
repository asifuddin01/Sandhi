import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getViewer: vi.fn(),
  authorize: vi.fn(),
  checkRateLimit: vi.fn(),
  getSiteSettings: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

// `server-only` is a build-time guard with no node entry point.
vi.mock("server-only", () => ({}));

vi.mock("@/lib/authz", () => ({
  getViewer: mocks.getViewer,
  authorize: mocks.authorize,
  AuthorizationError: mocks.AuthorizationError,
}));

vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }));

vi.mock("@/lib/site-settings", () => ({
  getSiteSettings: mocks.getSiteSettings,
  isSectionEnabled: vi.fn(),
}));

import { ApiError } from "@/lib/api/errors";
import { apiRoute, found, readApiJson } from "@/lib/api/handler";
import { ServiceConfigurationError } from "@/lib/forms-services";
import { defaultMobileAppSettings } from "@/lib/mobile-app";

const viewer = {
  userId: "user-1",
  sessionId: "session-1",
  sessionCreatedAt: new Date(),
  email: "member@sandhi.test",
  name: "A Member",
  role: "MEMBER" as const,
  twoFactorEnabled: false,
  member: null,
};

function get(url = "https://sandhiresearch.org/api/v1/thing", client?: string) {
  return new Request(url, {
    headers: client ? { "x-sandhi-client": client } : {},
  });
}

function post(body: unknown, client?: string) {
  return new Request("https://sandhiresearch.org/api/v1/thing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(client ? { "x-sandhi-client": client } : {}),
    },
    body: JSON.stringify(body),
  });
}

const allowed = {
  allowed: true,
  limit: 10,
  remaining: 9,
  retryAfter: 0,
  mode: "development-bypass" as const,
};

describe("apiRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue(allowed);
    mocks.getSiteSettings.mockResolvedValue({
      mobileApp: defaultMobileAppSettings,
    });
    mocks.getViewer.mockResolvedValue(viewer);
    mocks.authorize.mockResolvedValue(viewer);
  });

  it("wraps the result in the shared envelope", async () => {
    const route = apiRoute({}, () => ({ ok: true }));
    const response = await route(get());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { ok: true },
      meta: { apiVersion: 1 },
    });
  });

  it("caches a public read and never a signed-in one", async () => {
    const publicRoute = apiRoute(
      { cache: { maxAge: 60, staleWhileRevalidate: 300 } },
      () => ({}),
    );
    expect((await publicRoute(get())).headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );

    const privateRoute = apiRoute(
      { auth: true, cache: { maxAge: 60, staleWhileRevalidate: 300 } },
      () => ({}),
    );
    expect((await privateRoute(get())).headers.get("cache-control")).toBe(
      "private, no-store",
    );
  });

  it("requires a client header on a mutation but not on a read", async () => {
    const route = apiRoute({}, () => ({ ok: true }));

    const refused = await route(post({}));
    expect(refused.status).toBe(428);
    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "client_required" },
    });

    expect((await route(post({}, "sandhi-mobile/1.0 (ios)"))).status).toBe(200);
    expect((await route(get())).status).toBe(200);
  });

  it("passes the parsed client through to the handler", async () => {
    const route = apiRoute({}, ({ client }) => client);
    const response = await route(
      get(undefined, "sandhi-mobile/1.4.0 (android; build=9)"),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { name: "sandhi-mobile", platform: "android", build: 9 },
    });
  });

  it("asks an app below the minimum to update, and says where to get it", async () => {
    mocks.getSiteSettings.mockResolvedValue({
      mobileApp: { ...defaultMobileAppSettings, minimumVersion: "2.0.0" },
    });
    const route = apiRoute({}, () => ({ ok: true }));

    const refused = await route(
      get(undefined, "sandhi-mobile/1.0.0 (android)"),
    );
    expect(refused.status).toBe(426);
    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "upgrade_required", details: { minimumVersion: "2.0.0" } },
    });

    // A browser is never asked to update.
    expect((await route(get(undefined, "sandhi-web/0.1 (web)"))).status).toBe(
      200,
    );
  });

  it("refuses a signed-out caller and a caller without the capability", async () => {
    mocks.getViewer.mockResolvedValue(null);
    const authed = apiRoute({ auth: true }, () => ({ ok: true }));
    expect((await authed(get())).status).toBe(401);

    mocks.getViewer.mockResolvedValue(viewer);
    mocks.authorize.mockRejectedValue(
      new mocks.AuthorizationError("Set up two-factor authentication first."),
    );
    const staffOnly = apiRoute({ auth: "members:manage" }, () => ({
      ok: true,
    }));
    const refused = await staffOnly(get());
    expect(refused.status).toBe(403);
    await expect(refused.json()).resolves.toMatchObject({
      error: {
        code: "forbidden",
        message: "Set up two-factor authentication first.",
      },
    });
  });

  it("states the wait when the limit is reached", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      ...allowed,
      allowed: false,
      retryAfter: 30,
    });
    const route = apiRoute(
      { rateLimit: { scope: "test", limit: 1, windowSeconds: 60 } },
      () => ({ ok: true }),
    );
    const response = await route(get());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("stays up for a read when the limiter is down, and closes otherwise", async () => {
    mocks.checkRateLimit.mockRejectedValue(
      new ServiceConfigurationError("Upstash", "not configured"),
    );

    const open = apiRoute(
      {
        rateLimit: {
          scope: "test",
          limit: 1,
          windowSeconds: 60,
          failOpen: true,
        },
      },
      () => ({ ok: true }),
    );
    expect((await open(get())).status).toBe(200);

    const closed = apiRoute(
      { rateLimit: { scope: "test", limit: 1, windowSeconds: 60 } },
      () => ({ ok: true }),
    );
    expect((await closed(get())).status).toBe(503);
  });

  it("turns a missing record into a 404 and an unexpected fault into a 500", async () => {
    const missing = apiRoute({}, () => found(null, "No such thing."));
    const notFound = await missing(get());
    expect(notFound.status).toBe(404);
    await expect(notFound.json()).resolves.toMatchObject({
      error: { code: "not_found", message: "No such thing." },
    });

    const secret = "connection string with a password";
    const broken = apiRoute({}, () => {
      throw new Error(secret);
    });
    const failed = await broken(get());
    expect(failed.status).toBe(500);
    const body = await failed.text();
    expect(body).not.toContain(secret);
    expect(JSON.parse(body)).toMatchObject({ error: { code: "server_error" } });
  });

  it("gives the handler the route parameters", async () => {
    const route = apiRoute<{ slug: string }>({}, ({ params }) => params);
    const response = await route(get(), {
      params: Promise.resolve({ slug: "attention" }),
    });
    await expect(response.json()).resolves.toMatchObject({
      data: { slug: "attention" },
    });
  });
});

describe("readApiJson", () => {
  const body = (init: RequestInit) =>
    readApiJson(
      new Request("https://sandhiresearch.org/api/v1/thing", {
        method: "POST",
        ...init,
      }),
    );

  it("reads a JSON body", async () => {
    await expect(
      body({
        headers: { "Content-Type": "application/json" },
        body: '{"a":1}',
      }),
    ).resolves.toEqual({ a: 1 });
  });

  it("refuses another content type, a broken body, and an oversized one", async () => {
    await expect(
      body({ headers: { "Content-Type": "text/plain" }, body: "{}" }),
    ).rejects.toMatchObject({ code: "unsupported_media_type" });

    await expect(
      body({ headers: { "Content-Type": "application/json" }, body: "{" }),
    ).rejects.toMatchObject({ code: "bad_request" });

    await expect(
      body({
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(1024 * 1024),
        },
        body: "{}",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
