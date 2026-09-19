/**
 * How the SANDHI app is published and which versions this deployment still
 * talks to. Pure, so the settings parser, the admin form, the download page,
 * and the API's version gate all agree without a database.
 *
 * Android is distributed as a signed APK from this site rather than a store,
 * so the page has to state the version, size, and SHA-256 a visitor can check
 * before installing. iOS has no equivalent sideload, so the setting records
 * whichever private distribution the lab uses (TestFlight or an enterprise or
 * Apple Business Manager link).
 */

export const IOS_DISTRIBUTIONS = [
  { key: "testflight", label: "TestFlight" },
  { key: "business-manager", label: "Apple Business Manager" },
  { key: "enterprise", label: "Enterprise (in-house)" },
  { key: "app-store", label: "App Store" },
] as const;

export type IosDistribution = (typeof IOS_DISTRIBUTIONS)[number]["key"];

export interface AndroidRelease {
  /** The marketing version, e.g. `1.4.0`. */
  version: string;
  /** Android's monotonic `versionCode`, used to order installs. */
  versionCode: number | null;
  /** An https address for the signed APK. */
  downloadUrl: string;
  sizeBytes: number | null;
  /** Lower-case hex SHA-256 of the exact file at `downloadUrl`. */
  sha256: string | null;
  minimumOsVersion: string | null;
  notes: string | null;
}

export interface IosRelease {
  version: string;
  distribution: IosDistribution;
  /** Where a member installs it (a TestFlight or distribution-service link). */
  installUrl: string;
  minimumOsVersion: string | null;
  notes: string | null;
}

export interface MobileAppSettings {
  /** Nothing is offered publicly until this is switched on. */
  enabled: boolean;
  android: AndroidRelease | null;
  ios: IosRelease | null;
  /** Released apps below this version are refused by the API. */
  minimumVersion: string | null;
}

export const defaultMobileAppSettings: MobileAppSettings = {
  enabled: false,
  android: null,
  ios: null,
  minimumVersion: null,
};

export const MAX_RELEASE_NOTES_LENGTH = 1000;
/** Well past any realistic app; a guard against a mistyped value, not a policy. */
export const MAX_APK_BYTES = 2 * 1024 * 1024 * 1024;

const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,3}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export function isVersionString(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value.trim());
}

export function normalizeSha256(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().toLowerCase().replace(/\s+/gu, "");
  return SHA256_PATTERN.test(hex) ? hex : null;
}

/** Bytes as a short, honest label: no rounding that hides a large download. */
export function formatBytes(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return null;
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`;
}

function httpsUrl(value: unknown, max = 500): string | null {
  if (typeof value !== "string" || value.length > max) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function positiveInteger(value: unknown, max: number): number | null {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  return typeof parsed === "number" &&
    Number.isInteger(parsed) &&
    parsed > 0 &&
    parsed <= max
    ? parsed
    : null;
}

/** Stored settings are never trusted: anything invalid falls back to "no release". */
export function parseMobileAppSettings(value: unknown): MobileAppSettings {
  if (!value || typeof value !== "object") return defaultMobileAppSettings;
  const stored = value as Record<string, unknown>;

  const androidStored = (stored.android ?? {}) as Record<string, unknown>;
  const androidVersion = androidStored.version;
  const androidUrl = httpsUrl(androidStored.downloadUrl);
  const android: AndroidRelease | null =
    isVersionString(androidVersion) && androidUrl
      ? {
          version: (androidVersion as string).trim(),
          versionCode: positiveInteger(
            androidStored.versionCode,
            2_100_000_000,
          ),
          downloadUrl: androidUrl,
          sizeBytes: positiveInteger(androidStored.sizeBytes, MAX_APK_BYTES),
          sha256: normalizeSha256(androidStored.sha256),
          minimumOsVersion: boundedText(androidStored.minimumOsVersion, 40),
          notes: boundedText(androidStored.notes, MAX_RELEASE_NOTES_LENGTH),
        }
      : null;

  const iosStored = (stored.ios ?? {}) as Record<string, unknown>;
  const iosVersion = iosStored.version;
  const iosUrl = httpsUrl(iosStored.installUrl);
  const distribution = IOS_DISTRIBUTIONS.find(
    (candidate) => candidate.key === iosStored.distribution,
  );
  const ios: IosRelease | null =
    isVersionString(iosVersion) && iosUrl
      ? {
          version: (iosVersion as string).trim(),
          distribution: distribution?.key ?? "testflight",
          installUrl: iosUrl,
          minimumOsVersion: boundedText(iosStored.minimumOsVersion, 40),
          notes: boundedText(iosStored.notes, MAX_RELEASE_NOTES_LENGTH),
        }
      : null;

  return {
    // The section stays hidden until there is something to install.
    enabled: stored.enabled === true && Boolean(android ?? ios),
    android,
    ios,
    minimumVersion: isVersionString(stored.minimumVersion)
      ? (stored.minimumVersion as string).trim()
      : null,
  };
}

export type MobileAppProblem = { field: string; message: string };

/**
 * Reads the admin form. A platform is published only when its version and
 * address are both given; filling in one alone is a mistake worth naming.
 */
export function readMobileAppForm(
  form: (name: string) => string,
  flags: (name: string) => boolean,
): { value: MobileAppSettings; problems: MobileAppProblem[] } {
  const problems: MobileAppProblem[] = [];
  const text = (name: string) => form(name).trim();

  const require = (
    field: string,
    condition: boolean,
    message: string,
  ): boolean => {
    if (!condition) problems.push({ field, message });
    return condition;
  };

  let android: AndroidRelease | null = null;
  const androidVersion = text("mobile.android.version");
  const androidUrl = text("mobile.android.downloadUrl");
  if (androidVersion || androidUrl) {
    const okVersion = require("mobile.android.version", isVersionString(
      androidVersion,
    ), "Give the Android release a version such as 1.0.0.");
    const okUrl = require("mobile.android.downloadUrl", Boolean(
      httpsUrl(androidUrl),
    ), "The APK needs a full https:// address.");
    const sha = text("mobile.android.sha256");
    const okSha = require("mobile.android.sha256", !sha ||
      normalizeSha256(sha) !==
        null, "The checksum must be 64 hexadecimal characters.");
    const size = text("mobile.android.sizeBytes");
    const okSize = require("mobile.android.sizeBytes", !size ||
      positiveInteger(size, MAX_APK_BYTES) !==
        null, "Give the APK size in bytes.");
    const code = text("mobile.android.versionCode");
    const okCode = require("mobile.android.versionCode", !code ||
      positiveInteger(code, 2_100_000_000) !==
        null, "The version code must be a whole number.");
    if (okVersion && okUrl && okSha && okSize && okCode) {
      android = {
        version: androidVersion,
        versionCode: positiveInteger(code, 2_100_000_000),
        downloadUrl: httpsUrl(androidUrl)!,
        sizeBytes: positiveInteger(size, MAX_APK_BYTES),
        sha256: normalizeSha256(sha),
        minimumOsVersion: boundedText(
          text("mobile.android.minimumOsVersion"),
          40,
        ),
        notes: boundedText(
          text("mobile.android.notes"),
          MAX_RELEASE_NOTES_LENGTH,
        ),
      };
    }
  }

  let ios: IosRelease | null = null;
  const iosVersion = text("mobile.ios.version");
  const iosUrl = text("mobile.ios.installUrl");
  if (iosVersion || iosUrl) {
    const okVersion = require("mobile.ios.version", isVersionString(
      iosVersion,
    ), "Give the iOS release a version such as 1.0.0.");
    const okUrl = require("mobile.ios.installUrl", Boolean(
      httpsUrl(iosUrl),
    ), "The iOS install link needs a full https:// address.");
    if (okVersion && okUrl) {
      const distribution = IOS_DISTRIBUTIONS.find(
        (candidate) => candidate.key === text("mobile.ios.distribution"),
      );
      ios = {
        version: iosVersion,
        distribution: distribution?.key ?? "testflight",
        installUrl: httpsUrl(iosUrl)!,
        minimumOsVersion: boundedText(text("mobile.ios.minimumOsVersion"), 40),
        notes: boundedText(text("mobile.ios.notes"), MAX_RELEASE_NOTES_LENGTH),
      };
    }
  }

  const minimum = text("mobile.minimumVersion");
  const okMinimum = require("mobile.minimumVersion", !minimum ||
    isVersionString(
      minimum,
    ), "The minimum supported version must look like 1.0.0.");

  return {
    value: {
      enabled: flags("mobile.enabled") && Boolean(android ?? ios),
      android,
      ios,
      minimumVersion: okMinimum && minimum ? minimum : null,
    },
    problems,
  };
}
