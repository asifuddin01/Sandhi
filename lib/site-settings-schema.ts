/**
 * Site settings stored as key/value rows. Pure so the parsing (which never
 * trusts stored values) and the admin validation can be tested.
 */

import { isEmailAddress } from "@/lib/email-address";
import {
  defaultMobileAppSettings,
  parseMobileAppSettings,
  readMobileAppForm,
  type MobileAppSettings,
} from "@/lib/mobile-app";

export const socialPlatforms = [
  { key: "github", label: "GitHub" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "bluesky", label: "Bluesky" },
  { key: "youtube", label: "YouTube" },
  { key: "scholar", label: "Google Scholar" },
] as const;

export type SocialKey = (typeof socialPlatforms)[number]["key"];

export const contactTopics = [
  { key: "general", label: "General enquiries" },
  { key: "research", label: "Research" },
  { key: "collaborations", label: "Collaborations" },
  { key: "applications", label: "Applications" },
] as const;

export type ContactTopicKey = (typeof contactTopics)[number]["key"];

export interface SiteSettings {
  contact: Record<ContactTopicKey, string>;
  location: string | null;
  social: Partial<Record<SocialKey, string>>;
  retentionMonths: number;
  features: {
    showEvents: boolean;
    showPartners: boolean;
    showNumbers: boolean;
  };
  maintenanceBanner: string | null;
  /** How the Android and iOS apps are published (see `lib/mobile-app.ts`). */
  mobileApp: MobileAppSettings;
}

export const settingKeys = {
  contact: (topic: ContactTopicKey) => `contact.${topic}`,
  location: "contact.location",
  social: "social.links",
  retentionMonths: "applications.retentionMonths",
  showEvents: "features.showEvents",
  showPartners: "features.showPartners",
  showNumbers: "features.showNumbers",
  maintenanceBanner: "site.maintenanceBanner",
  mobileApp: "mobile.app",
} as const;

export const defaultSiteSettings: SiteSettings = {
  contact: {
    general: "contact@sandhiresearch.org",
    research: "research@sandhiresearch.org",
    collaborations: "collaborate@sandhiresearch.org",
    applications: "join@sandhiresearch.org",
  },
  location: null,
  social: {},
  retentionMonths: 24,
  features: { showEvents: true, showPartners: true, showNumbers: false },
  maintenanceBanner: null,
  mobileApp: defaultMobileAppSettings,
};

export const MAX_RETENTION_MONTHS = 120;
export const MAX_BANNER_LENGTH = 280;
export const MAX_LOCATION_LENGTH = 200;

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

/** Stored values are checked again on read; anything invalid falls back. */
export function parseSiteSettings(
  rows: Array<{ key: string; value: unknown }>,
): SiteSettings {
  const byKey = new Map(rows.map(({ key, value }) => [key, value]));
  const flag = (key: string, fallback: boolean) => {
    const value = byKey.get(key);
    return typeof value === "boolean" ? value : fallback;
  };

  const contact = { ...defaultSiteSettings.contact };
  for (const { key } of contactTopics) {
    const value = byKey.get(settingKeys.contact(key));
    if (typeof value === "string" && isEmailAddress(value)) {
      contact[key] = value;
    }
  }

  const social: SiteSettings["social"] = {};
  const storedSocial = byKey.get(settingKeys.social);
  if (storedSocial && typeof storedSocial === "object") {
    for (const { key } of socialPlatforms) {
      const value = (storedSocial as Record<string, unknown>)[key];
      if (isHttpsUrl(value)) social[key] = value;
    }
  }

  const retention = byKey.get(settingKeys.retentionMonths);

  return {
    contact,
    location: text(byKey.get(settingKeys.location), MAX_LOCATION_LENGTH),
    social,
    retentionMonths:
      typeof retention === "number" &&
      Number.isInteger(retention) &&
      retention > 0 &&
      retention <= MAX_RETENTION_MONTHS
        ? retention
        : defaultSiteSettings.retentionMonths,
    features: {
      showEvents: flag(settingKeys.showEvents, true),
      showPartners: flag(settingKeys.showPartners, true),
      // Opt-in: shown only when explicitly enabled.
      showNumbers: byKey.get(settingKeys.showNumbers) === true,
    },
    maintenanceBanner: text(
      byKey.get(settingKeys.maintenanceBanner),
      MAX_BANNER_LENGTH,
    ),
    mobileApp: parseMobileAppSettings(byKey.get(settingKeys.mobileApp)),
  };
}

/**
 * Settings as the admin form stores them, key by key. Comparing a submission
 * with this (rather than with raw rows) means a key that was never stored
 * still counts as its default, so saving an untouched form changes nothing.
 */
export function storedSettingValues(
  settings: SiteSettings,
): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      contactTopics.map(({ key }) => [
        settingKeys.contact(key),
        settings.contact[key],
      ]),
    ),
    [settingKeys.location]: settings.location ?? "",
    [settingKeys.social]: Object.fromEntries(
      socialPlatforms.flatMap(({ key }) => {
        const value = settings.social[key];
        return value ? [[key, value]] : [];
      }),
    ),
    [settingKeys.retentionMonths]: settings.retentionMonths,
    [settingKeys.showEvents]: settings.features.showEvents,
    [settingKeys.showPartners]: settings.features.showPartners,
    [settingKeys.showNumbers]: settings.features.showNumbers,
    [settingKeys.maintenanceBanner]: settings.maintenanceBanner ?? "",
    [settingKeys.mobileApp]: settings.mobileApp,
  };
}

/** Public sections switched off in settings, as path prefixes. */
export function hiddenSectionPaths(settings: SiteSettings): string[] {
  return [
    ...(settings.features.showEvents ? [] : ["/events"]),
    ...(settings.features.showPartners ? [] : ["/partners"]),
    // The app page exists only once there is a build to install.
    ...(settings.mobileApp.enabled ? [] : ["/app"]),
  ];
}

export function isPathHidden(path: string, hidden: string[]): boolean {
  return hidden.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export type SettingsProblem = { field: string; message: string };

/** Validates the admin form and returns the values to store, key by key. */
export function readSettingsForm(
  form: (name: string) => string,
  flags: (name: string) => boolean,
): { values: Record<string, unknown>; problems: SettingsProblem[] } {
  const problems: SettingsProblem[] = [];
  const values: Record<string, unknown> = {};

  for (const { key, label } of contactTopics) {
    const value = form(`contact.${key}`).trim().toLowerCase();
    if (!isEmailAddress(value)) {
      problems.push({
        field: `contact.${key}`,
        message: `${label} needs a valid email address.`,
      });
    }
    values[settingKeys.contact(key)] = value;
  }

  const location = form("location").trim();
  if (location.length > MAX_LOCATION_LENGTH) {
    problems.push({
      field: "location",
      message: `Keep the location under ${MAX_LOCATION_LENGTH} characters.`,
    });
  }
  values[settingKeys.location] = location;

  const social: Record<string, string> = {};
  for (const { key, label } of socialPlatforms) {
    const value = form(`social.${key}`).trim();
    if (!value) continue;
    if (!isHttpsUrl(value)) {
      problems.push({
        field: `social.${key}`,
        message: `${label} needs a full https:// address.`,
      });
    } else {
      social[key] = value;
    }
  }
  values[settingKeys.social] = social;

  const retention = Number(form("retentionMonths"));
  if (
    !Number.isInteger(retention) ||
    retention < 1 ||
    retention > MAX_RETENTION_MONTHS
  ) {
    problems.push({
      field: "retentionMonths",
      message: `Keep applications for 1 to ${MAX_RETENTION_MONTHS} months.`,
    });
  }
  values[settingKeys.retentionMonths] = retention;

  values[settingKeys.showEvents] = flags("showEvents");
  values[settingKeys.showPartners] = flags("showPartners");
  values[settingKeys.showNumbers] = flags("showNumbers");

  const banner = form("maintenanceBanner").trim();
  if (banner.length > MAX_BANNER_LENGTH) {
    problems.push({
      field: "maintenanceBanner",
      message: `Keep the banner under ${MAX_BANNER_LENGTH} characters.`,
    });
  }
  values[settingKeys.maintenanceBanner] = banner;

  const mobile = readMobileAppForm(
    (name) => form(name),
    (name) => flags(name),
  );
  problems.push(...mobile.problems);
  values[settingKeys.mobileApp] = mobile.value;

  return { values, problems };
}
