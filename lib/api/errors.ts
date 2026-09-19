/**
 * Refusals the API states in a stable, machine-readable way, so the mobile app
 * can react (sign in again, prompt for an update) rather than parse prose.
 */

export const apiErrorCodes = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  client_required: 428,
  rate_limited: 429,
  upgrade_required: 426,
  service_unavailable: 503,
  server_error: 500,
} as const;

export type ApiErrorCode = keyof typeof apiErrorCodes;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = apiErrorCodes[code];
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new ApiError("bad_request", message, details);
  }

  static unauthenticated(message = "Sign in to continue.") {
    return new ApiError("unauthenticated", message);
  }

  static forbidden(message = "You do not have permission to do that.") {
    return new ApiError("forbidden", message);
  }

  static notFound(message = "Not found.") {
    return new ApiError("not_found", message);
  }
}
