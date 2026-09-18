/**
 * Configuration that must be safe before production serves a request. Pure,
 * so scripts and tests share the checks with the application.
 */

const LOCAL_DATABASE_HOSTS = new Set(["", "localhost", "127.0.0.1", "[::1]"]);
const TLS_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

/** Better Auth signs sessions and encrypts secrets with this key. */
export const MIN_AUTH_SECRET_LENGTH = 32;

export function isProductionEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

/**
 * In production a database on another host must be reached over TLS, so
 * member and applicant data never crosses the network in the clear.
 */
export function databaseUrlProblem(
  databaseUrl: string,
  env: NodeJS.ProcessEnv,
): string | null {
  if (!isProductionEnv(env)) return null;

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return "DATABASE_URL is not a valid connection string.";
  }
  if (LOCAL_DATABASE_HOSTS.has(url.hostname)) return null;

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  if (sslMode && TLS_SSL_MODES.has(sslMode)) return null;
  return "DATABASE_URL must use TLS in production: add sslmode=require (Neon connection strings include it).";
}

export function authSecretProblem(
  secret: string | undefined,
  env: NodeJS.ProcessEnv,
): string | null {
  if (!isProductionEnv(env)) return null;
  const value = secret?.trim() ?? "";
  if (value.length >= MIN_AUTH_SECRET_LENGTH) return null;
  return `BETTER_AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} random characters in production (generate one with: openssl rand -base64 32).`;
}
