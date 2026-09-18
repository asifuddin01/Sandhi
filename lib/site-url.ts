import "server-only";

import { headers } from "next/headers";

import {
  isProductionEnvironment,
  ServiceConfigurationError,
} from "@/lib/forms-services";

/**
 * The public origin for links in emails. Production requires BETTER_AUTH_URL:
 * trusting the request's Host header there would let a forged header point an
 * invitation link, and its token, at another site. Local development falls
 * back to the request's host.
 */
export async function siteOrigin(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (configured) return new URL(configured).origin;

  if (isProductionEnvironment(env)) {
    throw new ServiceConfigurationError(
      "Better Auth",
      "BETTER_AUTH_URL is required in production.",
    );
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  return `http://${host}`;
}
