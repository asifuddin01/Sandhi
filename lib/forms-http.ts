import {
  ExternalServiceError,
  ServiceConfigurationError,
  errorMessage,
} from "@/lib/forms-services";

export function serviceErrorResponse(error: unknown): Response | null {
  if (
    !(error instanceof ServiceConfigurationError) &&
    !(error instanceof ExternalServiceError)
  ) {
    return null;
  }

  console.error(
    `[${error.service}] public form service failure: ${errorMessage(error)}`,
  );
  return Response.json(
    {
      message:
        "This form is temporarily unavailable. Please try again in a few minutes.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Refuses form posts made from another site. Browsers attach `Origin` to every
 * `fetch` POST and `Sec-Fetch-Site` where supported; either one naming another
 * site is refused. A missing `Origin` is accepted only outside production so
 * tests and tools can call the routes directly.
 */
export function isSameOriginRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return env.NODE_ENV !== "production";

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function crossSiteResponse(message: string): Response {
  return Response.json(
    { message },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { message: "Too many attempts. Please wait before trying again." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(Math.max(1, retryAfter)),
      },
    },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new TypeError("JSON_REQUIRED");
  }

  return request.json();
}
