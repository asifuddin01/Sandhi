/**
 * Verified deep links, so a SANDHI address opens in the installed app rather
 * than a browser: Android App Links read `/.well-known/assetlinks.json` and
 * iOS Universal Links read `/.well-known/apple-app-site-association`.
 *
 * Both are built from environment values, not from settings: they name the
 * signing certificate and the app id, which belong with the deployment rather
 * than with editable content. Pure, so the shapes can be tested.
 */

/** Paths a link may open in the app. Everything else stays in the browser. */
export const APP_LINK_PATHS = [
  "/",
  "/about",
  "/research/*",
  "/projects/*",
  "/publications/*",
  "/people/*",
  "/news/*",
  "/events/*",
  "/insights/*",
  "/resources/*",
  "/opportunities/*",
  "/partners",
  "/app",
] as const;

/**
 * Never handed to the app. Signing in, administration, uploads, and the API
 * stay in the browser, where the session cookie and the CSP apply.
 */
export const APP_LINK_EXCLUDED_PATHS = [
  "/portal/*",
  "/admin/*",
  "/api/*",
  "/join*",
  "/.well-known/*",
] as const;

const FINGERPRINT = /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/u;

/** `AA:BB:…` SHA-256 certificate fingerprints, upper-cased and de-duplicated. */
export function parseAndroidFingerprints(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const entry of value.split(/[,\s]+/u)) {
    const fingerprint = entry.trim().toUpperCase();
    if (FINGERPRINT.test(fingerprint)) seen.add(fingerprint);
  }
  return [...seen];
}

export function isAndroidPackageName(
  value: string | undefined,
): value is string {
  return (
    typeof value === "string" &&
    /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/u.test(value) &&
    value.length <= 200
  );
}

/** Apple's `<TeamID>.<bundle id>` application identifier. */
export function isAppleAppId(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[A-Z0-9]{10}\.[A-Za-z0-9][A-Za-z0-9.-]{0,180}$/u.test(value)
  );
}

export interface AndroidAppLink {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

/** Empty when the deployment has not published an Android app yet. */
export function buildAssetLinks(
  env: NodeJS.ProcessEnv = process.env,
): AndroidAppLink[] {
  const packageName = env.ANDROID_APP_ID?.trim();
  const fingerprints = parseAndroidFingerprints(env.ANDROID_APP_FINGERPRINTS);
  if (!isAndroidPackageName(packageName) || fingerprints.length === 0) {
    return [];
  }

  return [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        // Lets the app offer to fill a SANDHI password it saved.
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export interface AppleAppSiteAssociation {
  applinks: {
    details: Array<{
      appIDs: string[];
      components: Array<{ "/": string; comment?: string; exclude?: true }>;
    }>;
  };
  webcredentials: { apps: string[] };
}

/** Null when the deployment has not published an iOS app yet. */
export function buildAppleAppSiteAssociation(
  env: NodeJS.ProcessEnv = process.env,
): AppleAppSiteAssociation | null {
  const appId = env.IOS_APP_ID?.trim();
  if (!isAppleAppId(appId)) return null;

  return {
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: [
            ...APP_LINK_EXCLUDED_PATHS.map((path) => ({
              "/": path,
              exclude: true as const,
              comment: "Stays in the browser",
            })),
            ...APP_LINK_PATHS.map((path) => ({ "/": path })),
          ],
        },
      ],
    },
    // Lets iOS offer the SANDHI password it saved for this site.
    webcredentials: { apps: [appId] },
  };
}
