export const PARTNER_KINDS = [
  "UNIVERSITY",
  "LAB",
  "COMPANY",
  "OPEN_SOURCE",
  "FUNDER",
] as const;

export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  UNIVERSITY: "Universities",
  LAB: "Research labs",
  COMPANY: "Companies",
  OPEN_SOURCE: "Open-source organizations",
  FUNDER: "Funders",
};

export const PARTNER_EMPTY_COPY =
  "We welcome collaboration with universities, labs, and organizations. Get in touch through Join SANDHI.";

export function accessiblePartnerLogo(
  logoUrl: string | null,
  logoAlt: string | null,
): { src: string; alt: string } | null {
  const alt = logoAlt?.trim();
  return logoUrl && alt ? { src: logoUrl, alt } : null;
}

export function safePartnerUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
