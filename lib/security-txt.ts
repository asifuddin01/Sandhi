/**
 * RFC 9116 security.txt: where to report a vulnerability. Built per request
 * from the general contact address in site settings, with an expiry six
 * months ahead so the file never goes stale.
 */
const VALIDITY_MS = 180 * 24 * 60 * 60 * 1000;

export function buildSecurityTxt(input: {
  contact: string;
  origin: string;
  now?: Date;
}): string {
  const expires = new Date((input.now ?? new Date()).getTime() + VALIDITY_MS);
  return [
    `Contact: mailto:${input.contact}`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${input.origin}/.well-known/security.txt`,
    "",
  ].join("\n");
}
