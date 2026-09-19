/**
 * Native clients keep no cookie jar, so the mobile sign-in routes read what
 * Better Auth would have set as cookies and hand the app opaque strings
 * instead. Pure, so the cookie parsing and the checks that stop a client
 * injecting a header can be tested without a request.
 */

export interface ParsedCookie {
  name: string;
  value: string;
  /** Lower-cased attribute names mapped to their value ("" when valueless). */
  attributes: Record<string, string>;
}

/** Cookie names and values that are safe to place back into a Cookie header. */
const COOKIE_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,128}$/u;
const COOKIE_VALUE = /^[A-Za-z0-9!#$%&'()*+./:<=>?@[\]^_{|}~-]{1,4096}$/u;

export function parseSetCookie(header: string): ParsedCookie | null {
  const [pair = "", ...rest] = header.split(";");
  const separator = pair.indexOf("=");
  if (separator <= 0) return null;

  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();
  if (!COOKIE_NAME.test(name)) return null;

  const attributes: Record<string, string> = {};
  for (const part of rest) {
    const index = part.indexOf("=");
    const key = (index === -1 ? part : part.slice(0, index))
      .trim()
      .toLowerCase();
    if (key) attributes[key] = index === -1 ? "" : part.slice(index + 1).trim();
  }
  return { name, value, attributes };
}

export function parseSetCookies(headers: string[]): ParsedCookie[] {
  return headers
    .map(parseSetCookie)
    .filter((cookie): cookie is ParsedCookie => cookie !== null);
}

/**
 * The last cookie of a kind, as a browser would keep it. One response can set
 * the same cookie twice — two-factor sign-in creates a session and then clears
 * it before asking for the code — and only the final one counts.
 */
export function lastCookie(
  cookies: ParsedCookie[],
  matches: (name: string) => boolean,
): ParsedCookie | null {
  for (let index = cookies.length - 1; index >= 0; index -= 1) {
    const cookie = cookies[index]!;
    if (matches(cookie.name)) return cookie;
  }
  return null;
}

/** Whether a Set-Cookie establishes a cookie rather than deleting one. */
export function cookieIsSet(
  cookie: ParsedCookie | null,
): cookie is ParsedCookie {
  if (!cookie || !cookie.value) return false;
  const maxAge = cookie.attributes["max-age"];
  return maxAge === undefined || Number.parseInt(maxAge, 10) > 0;
}

/** Host prefixes are part of the cookie name but not of its meaning. */
function withoutPrefix(name: string): string {
  return name.replace(/^__(Secure|Host)-/u, "");
}

export function isTwoFactorCookieName(name: string): boolean {
  return /(^|[._-])two_factor$/u.test(withoutPrefix(name));
}

export function isSessionCookieName(name: string): boolean {
  return /(^|[._-])session_token$/u.test(withoutPrefix(name));
}

/** Seconds until the session cookie expires, when the header says. */
export function cookieLifetimeSeconds(cookie: ParsedCookie): number | null {
  const maxAge = Number.parseInt(cookie.attributes["max-age"] ?? "", 10);
  if (Number.isFinite(maxAge) && maxAge > 0) return maxAge;

  const expires = cookie.attributes.expires;
  if (!expires) return null;
  const at = Date.parse(expires);
  if (Number.isNaN(at)) return null;
  const seconds = Math.round((at - Date.now()) / 1000);
  return seconds > 0 ? seconds : null;
}

/**
 * The pending two-factor challenge as one opaque string the app returns with
 * the code. Better Auth already signs the cookie, so this only has to survive
 * the round trip and be refused if it comes back as anything else.
 */
export function encodeTwoFactorChallenge(cookie: ParsedCookie): string {
  return Buffer.from(`${cookie.name}=${cookie.value}`, "utf8").toString(
    "base64url",
  );
}

/**
 * The Cookie header for a challenge the app sends back, or null when it is not
 * exactly one two-factor cookie: nothing else may reach the Cookie header.
 */
export function decodeTwoFactorChallenge(encoded: unknown): string | null {
  if (typeof encoded !== "string" || !encoded || encoded.length > 8192) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const separator = decoded.indexOf("=");
  if (separator <= 0) return null;
  const name = decoded.slice(0, separator);
  const value = decoded.slice(separator + 1);

  if (!COOKIE_NAME.test(name) || !COOKIE_VALUE.test(value)) return null;
  if (!isTwoFactorCookieName(name)) return null;
  return `${name}=${value}`;
}
