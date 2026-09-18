import { describe, expect, it } from "vitest";

import {
  defaultSiteSettings,
  hiddenSectionPaths,
  isHttpsUrl,
  isPathHidden,
  MAX_BANNER_LENGTH,
  parseSiteSettings,
  readSettingsForm,
  settingKeys,
  storedSettingValues,
  type SiteSettings,
} from "@/lib/site-settings-schema";

const validForm: Record<string, string> = {
  "contact.general": "Hello@Example.org ",
  "contact.research": "research@example.org",
  "contact.collaborations": "collaborate@example.org",
  "contact.applications": "join@example.org",
  location: " Dhaka ",
  "social.github": "https://github.com/sandhi",
  "social.x": "",
  retentionMonths: "18",
  maintenanceBanner: "  Scheduled maintenance tonight.  ",
};

function read(
  overrides: Record<string, string> = {},
  checked: string[] = ["showEvents"],
) {
  const form = { ...validForm, ...overrides };
  return readSettingsForm(
    (name) => form[name] ?? "",
    (name) => checked.includes(name),
  );
}

describe("parseSiteSettings", () => {
  it("falls back to the defaults when nothing is stored", () => {
    expect(parseSiteSettings([])).toEqual(defaultSiteSettings);
  });

  it("keeps valid stored values", () => {
    const settings = parseSiteSettings([
      { key: settingKeys.contact("general"), value: "hi@example.org" },
      { key: settingKeys.location, value: "Dhaka" },
      {
        key: settingKeys.social,
        value: { github: "https://github.com/sandhi" },
      },
      { key: settingKeys.retentionMonths, value: 12 },
      { key: settingKeys.showEvents, value: false },
      { key: settingKeys.showNumbers, value: true },
      { key: settingKeys.maintenanceBanner, value: "Back soon." },
    ]);

    expect(settings.contact.general).toBe("hi@example.org");
    expect(settings.contact.research).toBe(
      defaultSiteSettings.contact.research,
    );
    expect(settings.location).toBe("Dhaka");
    expect(settings.social).toEqual({ github: "https://github.com/sandhi" });
    expect(settings.retentionMonths).toBe(12);
    expect(settings.features).toEqual({
      showEvents: false,
      showPartners: true,
      showNumbers: true,
    });
    expect(settings.maintenanceBanner).toBe("Back soon.");
  });

  it("never trusts stored values of the wrong shape", () => {
    const settings = parseSiteSettings([
      { key: settingKeys.contact("general"), value: "not an email" },
      {
        key: settingKeys.social,
        value: {
          github: "javascript:alert(1)",
          x: "http://x.com/sandhi",
          linkedin: 42,
          unknown: "https://example.org",
        },
      },
      { key: settingKeys.retentionMonths, value: 9999 },
      { key: settingKeys.showEvents, value: "false" },
      { key: settingKeys.showNumbers, value: "true" },
      {
        key: settingKeys.maintenanceBanner,
        value: "x".repeat(MAX_BANNER_LENGTH + 1),
      },
      { key: settingKeys.location, value: "   " },
    ]);

    expect(settings).toEqual(defaultSiteSettings);
  });
});

describe("hidden sections", () => {
  it("lists switched-off sections and matches their subpaths only", () => {
    const hidden = hiddenSectionPaths({
      ...defaultSiteSettings,
      features: { showEvents: false, showPartners: true, showNumbers: false },
    });

    expect(hidden).toEqual(["/events"]);
    expect(isPathHidden("/events", hidden)).toBe(true);
    expect(isPathHidden("/events/launch-seminar", hidden)).toBe(true);
    expect(isPathHidden("/events-archive", hidden)).toBe(false);
    expect(isPathHidden("/partners", hidden)).toBe(false);
    expect(hiddenSectionPaths(defaultSiteSettings)).toEqual([]);
  });
});

describe("isHttpsUrl", () => {
  it("accepts only https addresses", () => {
    expect(isHttpsUrl("https://example.org/a")).toBe(true);
    expect(isHttpsUrl("http://example.org")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("//example.org")).toBe(false);
    expect(isHttpsUrl(`https://example.org/${"a".repeat(500)}`)).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
  });
});

describe("readSettingsForm", () => {
  it("normalises a valid form into stored values", () => {
    const { values, problems } = read();

    expect(problems).toEqual([]);
    expect(values).toEqual({
      "contact.general": "hello@example.org",
      "contact.research": "research@example.org",
      "contact.collaborations": "collaborate@example.org",
      "contact.applications": "join@example.org",
      "contact.location": "Dhaka",
      "social.links": { github: "https://github.com/sandhi" },
      "applications.retentionMonths": 18,
      "features.showEvents": true,
      "features.showPartners": false,
      "features.showNumbers": false,
      "site.maintenanceBanner": "Scheduled maintenance tonight.",
    });
  });

  it("reports every invalid field", () => {
    const { problems } = read({
      "contact.research": "nobody",
      "social.linkedin": "http://linkedin.com/company/sandhi",
      retentionMonths: "0",
      maintenanceBanner: "x".repeat(MAX_BANNER_LENGTH + 1),
      location: "y".repeat(201),
    });

    expect(problems.map((problem) => problem.field)).toEqual([
      "contact.research",
      "location",
      "social.linkedin",
      "retentionMonths",
      "maintenanceBanner",
    ]);
  });

  it("reads an untouched form as exactly the current settings", () => {
    const settings = parseSiteSettings([
      { key: settingKeys.location, value: "Dhaka" },
      { key: settingKeys.social, value: { x: "https://x.com/sandhi" } },
      { key: settingKeys.showPartners, value: false },
      { key: settingKeys.maintenanceBanner, value: "Back soon." },
    ]);
    const stored = storedSettingValues(settings);
    const form: Record<string, string> = {
      location: settings.location ?? "",
      retentionMonths: String(settings.retentionMonths),
      maintenanceBanner: settings.maintenanceBanner ?? "",
      "social.x": settings.social.x ?? "",
      ...Object.fromEntries(
        Object.entries(settings.contact).map(([key, value]) => [
          `contact.${key}`,
          value,
        ]),
      ),
    };
    const { values, problems } = readSettingsForm(
      (name) => form[name] ?? "",
      (name) =>
        settings.features[name as keyof SiteSettings["features"]] === true,
    );

    expect(problems).toEqual([]);
    expect(JSON.stringify(values)).toBe(JSON.stringify(stored));
    expect(storedSettingValues(defaultSiteSettings)).toMatchObject({
      "contact.location": "",
      "social.links": {},
      "site.maintenanceBanner": "",
    });
  });

  it("rejects fractional and non-numeric retention", () => {
    expect(read({ retentionMonths: "1.5" }).problems).toHaveLength(1);
    expect(read({ retentionMonths: "abc" }).problems).toHaveLength(1);
    expect(read({ retentionMonths: "121" }).problems).toHaveLength(1);
    expect(read({ retentionMonths: "120" }).problems).toHaveLength(0);
  });
});
