import { API_VERSION } from "@/lib/api/contract";
import { ApiError, type ApiErrorCode } from "@/lib/api/errors";

/**
 * One envelope for every `/api/v1` response, so a client can tell a refusal
 * from an empty result without inspecting each route's shape.
 */
export interface ApiSuccessBody<T> {
  data: T;
  meta: { apiVersion: number };
}

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
  meta: { apiVersion: number };
}

export interface CachePolicy {
  maxAge: number;
  staleWhileRevalidate: number;
}

/** Signed-in answers are never stored; public reads may be held briefly. */
export function cacheControl(policy: CachePolicy | null): string {
  return policy
    ? `public, max-age=${policy.maxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`
    : "private, no-store";
}

export function apiOk<T>(
  data: T,
  options: { cache?: CachePolicy | null; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", cacheControl(options.cache ?? null));
  const body: ApiSuccessBody<T> = { data, meta: { apiVersion: API_VERSION } };
  return new Response(JSON.stringify(body), { status: 200, headers });
}

export function apiFail(
  error: ApiError,
  options: { headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "private, no-store");
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    meta: { apiVersion: API_VERSION },
  };
  return new Response(JSON.stringify(body), {
    status: error.status,
    headers,
  });
}
