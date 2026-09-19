// Imported by next.config.ts, so it must stay free of path aliases and
// server-only modules.

import { CSP_REPORT_GROUP, CSP_REPORT_PATH } from "./csp-reports";

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Names the endpoint that `report-to` refers to. */
export const REPORTING_ENDPOINTS = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

export interface ContentSecurityPolicyOptions {
  nonce: string;
  isDevelopment: boolean;
  /** Only when the page itself is served over HTTPS; local HTTP builds break otherwise. */
  upgradeInsecureRequests: boolean;
  env?: NodeJS.ProcessEnv;
}

function httpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The per-request Content Security Policy. Scripts must carry the request's
 * nonce; `'strict-dynamic'` extends that trust to scripts they load (Next.js
 * chunks, the lazy WebGL field, Turnstile), and the Turnstile host remains as a
 * fallback for browsers without `'strict-dynamic'`.
 */
export function buildContentSecurityPolicy({
  nonce,
  isDevelopment,
  upgradeInsecureRequests,
  env = process.env,
}: ContentSecurityPolicyOptions): string {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const uploadOrigin =
    accountId && /^[a-z0-9]+$/i.test(accountId)
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : null;
  const publicFilesOrigin = httpsOrigin(env.R2_PUBLIC_BASE_URL);

  const directives: Array<[string, Array<string | null | false>]> = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        TURNSTILE_ORIGIN,
        // React uses eval for richer error stacks in development only.
        isDevelopment && "'unsafe-eval'",
      ],
    ],
    // KaTeX, highlighted code, and motion set style attributes, which nonces
    // cannot cover. Scripts, not styles, are the injection risk.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // Private storage is listed because an attachment's own route answers
    // with a redirect to a signed link there; the bytes still need a
    // signature, and nothing is readable by URL alone.
    ["img-src", ["'self'", "data:", "blob:", publicFilesOrigin, uploadOrigin]],
    ["font-src", ["'self'", "data:"]],
    // Application PDFs upload straight from the browser to private storage.
    [
      "connect-src",
      ["'self'", TURNSTILE_ORIGIN, uploadOrigin, isDevelopment && "ws:"],
    ],
    ["frame-src", [TURNSTILE_ORIGIN]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    // Violations are reported, so an injection attempt leaves a trace.
    ["report-uri", [CSP_REPORT_PATH]],
    ["report-to", [CSP_REPORT_GROUP]],
  ];

  const policy = directives.map(([name, values]) =>
    [name, ...values.filter((value): value is string => Boolean(value))].join(
      " ",
    ),
  );
  if (upgradeInsecureRequests) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers that are identical for every response, including static files. */
export function staticSecurityHeaders(
  isProduction: boolean,
): Array<{ key: string; value: string }> {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Keeps this origin in its own browser process group.
    { key: "Origin-Agent-Cluster", value: "?1" },
    // No legacy plugin may load a cross-domain policy from this site.
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ...(isProduction
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]
      : []),
  ];
}

/** Account and API responses are never loaded into another site's page. */
export const sensitiveRoutes = [
  "/portal/:path*",
  "/admin/:path*",
  "/api/:path*",
];

export function sensitiveRouteHeaders(): Array<{ key: string; value: string }> {
  return [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }];
}
