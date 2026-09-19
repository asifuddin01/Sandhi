/**
 * The JSON contract shared by the website's own clients and the SANDHI mobile
 * app. Pure so both the parsing rules and the version gate can be tested
 * without a request; `lib/api/handler.ts` applies them.
 */

/** Bumped only for a breaking change; additive fields keep the same version. */
export const API_VERSION = 1;

/**
 * Every `/api/v1` request identifies its client. Browsers cannot attach a
 * custom header cross-site without a preflight, and the API answers none, so
 * requiring this header is also what keeps another site from posting to the
 * API with a visitor's cookies.
 */
export const CLIENT_HEADER = "x-sandhi-client";

export const clientPlatforms = ["android", "ios", "web", "unknown"] as const;

export type ClientPlatform = (typeof clientPlatforms)[number];

export interface ApiClient {
  /** The application name the client reported, lower-cased. */
  name: string;
  /** A dotted version, or null when the client did not report a usable one. */
  version: string | null;
  platform: ClientPlatform;
  /** A monotonic build number, where the client reported one. */
  build: number | null;
}

/**
 * `X-Sandhi-Client: sandhi-mobile/1.4.0 (android; build=42)`. Everything after
 * the name is optional: an unrecognisable header still identifies a client, so
 * the header's presence is the security property and its contents are only
 * used for update prompts.
 */
export function parseApiClient(value: string | null): ApiClient | null {
  if (typeof value !== "string") return null;
  const header = value.trim();
  if (!header || header.length > 200) return null;

  const [identity = "", ...rest] = header.split(/\s+/u);
  const [rawName = "", rawVersion] = identity.split("/", 2);
  const name = rawName.toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(name)) return null;

  const detail = rest.join(" ").toLowerCase();
  const platform =
    clientPlatforms.find(
      (candidate) =>
        candidate !== "unknown" &&
        new RegExp(`(^|[^a-z])${candidate}([^a-z]|$)`, "u").test(detail),
    ) ?? "unknown";
  const build = Number.parseInt(/build=(\d{1,9})/u.exec(detail)?.[1] ?? "", 10);

  return {
    name,
    version: /^\d{1,4}(\.\d{1,4}){0,3}$/u.test(rawVersion ?? "")
      ? (rawVersion as string)
      : null,
    platform,
    build: Number.isInteger(build) ? build : null,
  };
}

/** Numeric comparison of dotted versions; missing parts count as zero. */
export function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const a = Number.parseInt(leftParts[index] ?? "0", 10) || 0;
    const b = Number.parseInt(rightParts[index] ?? "0", 10) || 0;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

/**
 * Whether a released app is too old to talk to this deployment. Only the
 * store-installed platforms are gated: a browser always has the current code,
 * and an unidentified version is left alone rather than locked out.
 */
export function isClientOutdated(
  client: ApiClient,
  minimumVersion: string | null,
): boolean {
  if (!minimumVersion) return false;
  if (client.platform !== "android" && client.platform !== "ios") return false;
  if (!client.version) return false;
  return compareVersions(client.version, minimumVersion) < 0;
}
