import "server-only";

import {
  CLIENT_HEADER,
  isClientOutdated,
  parseApiClient,
  type ApiClient,
} from "@/lib/api/contract";
import { ApiError } from "@/lib/api/errors";
import { apiFail, apiOk, type CachePolicy } from "@/lib/api/respond";
import {
  authorize,
  AuthorizationError,
  getViewer,
  type Viewer,
} from "@/lib/authz";
import {
  ExternalServiceError,
  errorMessage,
  requestIdentifier,
  ServiceConfigurationError,
} from "@/lib/forms-services";
import type { Capability } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/ratelimit";
import { getSiteSettings } from "@/lib/site-settings";

/** Bodies are small JSON documents; anything larger is refused unread. */
export const MAX_API_BODY_BYTES = 64 * 1024;

export interface ApiRateLimit {
  scope: string;
  limit: number;
  windowSeconds: number;
  /**
   * Read-only routes stay available when the limiter cannot be reached;
   * anything that writes or checks credentials fails closed.
   */
  failOpen?: boolean;
}

export interface ApiRouteOptions {
  /** Signed-in routes name the capability they need; `true` means any viewer. */
  auth?: Capability | true;
  rateLimit?: ApiRateLimit;
  /** Public reads may be cached briefly; signed-in routes never are. */
  cache?: CachePolicy;
  /**
   * Whether the `X-Sandhi-Client` header is required. Mutations always require
   * it (it is what stops another site posting with a visitor's cookies).
   */
  requireClient?: boolean;
}

export interface ApiContext<Params> {
  request: Request;
  params: Params;
  searchParams: URLSearchParams;
  client: ApiClient | null;
  /** Present whenever `auth` was set; null otherwise. */
  viewer: Viewer | null;
}

type RouteHandler<Params, Result> = (
  context: ApiContext<Params>,
) => Promise<Result> | Result;

async function enforceRateLimit(
  request: Request,
  limit: ApiRateLimit,
): Promise<void> {
  let decision;
  try {
    decision = await checkRateLimit({
      scope: limit.scope,
      identifier: requestIdentifier(request),
      limit: limit.limit,
      windowSeconds: limit.windowSeconds,
    });
  } catch (error) {
    if (limit.failOpen) {
      console.error(`[api] rate limiting unavailable for ${limit.scope}.`);
      return;
    }
    throw error;
  }
  if (!decision.allowed) {
    throw new ApiError("rate_limited", "Too many requests. Please wait.", {
      retryAfter: Math.max(1, decision.retryAfter),
    });
  }
}

/** Refuses a released app that is older than the deployment supports. */
async function enforceMinimumVersion(client: ApiClient): Promise<void> {
  if (client.platform !== "android" && client.platform !== "ios") return;
  const { mobileApp } = await getSiteSettings();
  if (!isClientOutdated(client, mobileApp.minimumVersion)) return;
  throw new ApiError("upgrade_required", "Update the app to continue.", {
    minimumVersion: mobileApp.minimumVersion,
    android: mobileApp.android,
    ios: mobileApp.ios,
  });
}

async function resolveViewer(auth: Capability | true): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw ApiError.unauthenticated();
  if (auth === true) return viewer;

  // The same check the pages and server actions make; nothing API-specific.
  try {
    return await authorize(auth);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw ApiError.forbidden(error.message);
    }
    throw error;
  }
}

function failureResponse(error: unknown, route: string): Response {
  if (error instanceof ApiError) {
    const headers =
      error.code === "rate_limited"
        ? {
            "Retry-After": String(
              (error.details as { retryAfter?: number } | undefined)
                ?.retryAfter ?? 60,
            ),
          }
        : undefined;
    return apiFail(error, { headers });
  }
  if (error instanceof AuthorizationError) {
    return apiFail(ApiError.forbidden(error.message));
  }
  if (
    error instanceof ServiceConfigurationError ||
    error instanceof ExternalServiceError
  ) {
    console.error(`[api] ${route}: ${error.service} — ${errorMessage(error)}`);
    return apiFail(
      new ApiError(
        "service_unavailable",
        "This service is temporarily unavailable. Please try again shortly.",
      ),
    );
  }
  console.error(`[api] ${route} failed:`, errorMessage(error));
  return apiFail(
    new ApiError("server_error", "Something went wrong. Please try again."),
  );
}

/**
 * Wraps a route handler with the checks every `/api/v1` endpoint shares. The
 * handler returns plain data, which is wrapped in the standard envelope, or a
 * `Response` when it needs to set its own headers.
 */
export function apiRoute<
  Params extends Record<string, string> = Record<string, never>,
  Result = unknown,
>(options: ApiRouteOptions, handler: RouteHandler<Params, Result>) {
  return async function route(
    request: Request,
    context?: { params?: Promise<Params> },
  ): Promise<Response> {
    const url = new URL(request.url);
    const routeName = url.pathname;

    try {
      const mutating = request.method !== "GET" && request.method !== "HEAD";
      const client = parseApiClient(request.headers.get(CLIENT_HEADER));
      if ((options.requireClient ?? mutating) && !client) {
        throw new ApiError(
          "client_required",
          `Send a ${CLIENT_HEADER} header identifying your application.`,
        );
      }
      if (client) await enforceMinimumVersion(client);
      if (options.rateLimit) {
        await enforceRateLimit(request, options.rateLimit);
      }

      const viewer = options.auth ? await resolveViewer(options.auth) : null;
      const params = ((await context?.params) ?? {}) as Params;

      const result = await handler({
        request,
        params,
        searchParams: url.searchParams,
        client,
        viewer,
      });
      if (result instanceof Response) return result;
      return apiOk(result, { cache: options.auth ? null : options.cache });
    } catch (error) {
      return failureResponse(error, routeName);
    }
  };
}

/** Reads a small JSON body, refusing anything else before parsing it. */
export async function readApiJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(
      "unsupported_media_type",
      "Send a JSON body with Content-Type: application/json.",
    );
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_API_BODY_BYTES) {
    throw new ApiError("payload_too_large", "That request is too large.");
  }

  const text = await request.text();
  if (text.length > MAX_API_BODY_BYTES) {
    throw new ApiError("payload_too_large", "That request is too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw ApiError.badRequest("That request body is not valid JSON.");
  }
}

/** Turns a missing record into the shared 404 shape. */
export function found<T>(value: T | null | undefined, message?: string): T {
  if (value === null || value === undefined) throw ApiError.notFound(message);
  return value;
}
