import { getDb, isDatabaseConfigured } from "@/lib/db";
import type { ContactTopic } from "@/lib/forms";

export type ContactAddresses = Record<ContactTopic, string>;

export const defaultContactAddresses: ContactAddresses = {
  general: "contact@sandhiresearch.org",
  research: "research@sandhiresearch.org",
  collaborations: "collaborate@sandhiresearch.org",
  applications: "join@sandhiresearch.org",
};

const settingKeys: Record<ContactTopic, string> = {
  general: "contact.general",
  research: "contact.research",
  collaborations: "contact.collaborations",
  applications: "contact.applications",
};

export async function getContactAddresses(): Promise<ContactAddresses> {
  if (!isDatabaseConfigured()) return defaultContactAddresses;

  const settings = await getDb().siteSetting.findMany({
    where: { key: { in: Object.values(settingKeys) } },
    select: { key: true, value: true },
  });
  const result = { ...defaultContactAddresses };

  for (const [topic, key] of Object.entries(settingKeys) as [
    ContactTopic,
    string,
  ][]) {
    const stored = settings.find((setting) => setting.key === key)?.value;
    if (typeof stored === "string" && stored.includes("@"))
      result[topic] = stored;
  }

  return result;
}

export async function getContactLocation(): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  const setting = await getDb().siteSetting.findUnique({
    where: { key: "contact.location" },
    select: { value: true },
  });

  return typeof setting?.value === "string" && setting.value.trim()
    ? setting.value.trim()
    : null;
}

export async function getContactRecipient(
  topic: ContactTopic,
): Promise<string> {
  const addresses = await getContactAddresses();
  return addresses[topic];
}
