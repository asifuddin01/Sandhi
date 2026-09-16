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
