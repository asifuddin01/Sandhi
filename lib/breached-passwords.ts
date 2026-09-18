import { createHash } from "node:crypto";

export const BREACHED_PASSWORD_MESSAGE =
  "This password has appeared in a known data breach, so attackers try it first. Choose a different one.";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Checks a password against the Have I Been Pwned corpus without revealing
 * it: only the first five characters of its SHA-1 hash leave the server
 * (k-anonymity), and padded responses hide which hash was asked about. SHA-1
 * here is the lookup key the service defines, not how passwords are stored
 * (they are hashed with scrypt).
 *
 * Returns null when the service cannot answer; callers then allow the
 * password, so an outage never locks anyone out of choosing one.
 */
export async function isBreachedPassword(
  password: string,
  {
    fetcher = fetch,
    timeoutMs = 3000,
  }: { fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<boolean | null> {
  const hash = createHash("sha1")
    .update(password, "utf8")
    .digest("hex")
    .toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const response = await fetcher(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { "Add-Padding": "true", "User-Agent": "SANDHI Research Lab" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    for (const line of (await response.text()).split(/\r?\n/u)) {
      const [candidate, count] = line.trim().split(":");
      if (candidate?.toUpperCase() === suffix) return Number(count) > 0;
    }
    return false;
  } catch {
    return null;
  }
}

/** The message to show, or null when the password may be used. */
export async function breachedPasswordProblem(
  password: string,
  dependencies?: { fetcher?: Fetcher; timeoutMs?: number },
): Promise<string | null> {
  const breached = await isBreachedPassword(password, dependencies);
  if (breached === null) {
    console.warn(
      "[auth] breached-password check unavailable; allowing password",
    );
  }
  return breached ? BREACHED_PASSWORD_MESSAGE : null;
}
