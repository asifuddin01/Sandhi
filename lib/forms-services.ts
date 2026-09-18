import { createHash } from "node:crypto";

export class ServiceConfigurationError extends Error {
  readonly service: string;

  constructor(service: string, message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
    this.service = service;
  }
}

export class ExternalServiceError extends Error {
  readonly service: string;

  constructor(service: string, message: string) {
    super(message);
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

export function isProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function requestIdentifier(request: Request): string {
  return identifierFromHeaders(request.headers);
}

/** A stable, non-reversible client identifier for rate limiting. */
export function identifierFromHeaders(headers: Headers): string {
  const address =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown-client";

  return createHash("sha256").update(address).digest("hex").slice(0, 32);
}

export function requestIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    undefined
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
