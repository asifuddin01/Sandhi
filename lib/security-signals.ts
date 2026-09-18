/**
 * Pure helpers for security events: what to record about a request, and when
 * a pattern of events deserves an email to the account holder.
 */

/** Failed sign-ins within the window that trigger an alert email. */
export const FAILED_ATTEMPT_ALERT_THRESHOLD = 5;
export const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
/** At most one failed-attempt alert per account in this period. */
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000;
/** How far back a device and network count as known. */
export const KNOWN_SIGN_IN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * The network an address belongs to (IPv4 /24, IPv6 /48) rather than the
 * address itself: enough to recognise a place, without storing the exact
 * address of every sign-in.
 */
export function coarseNetwork(ip: string | null | undefined): string {
  const address = ip?.trim().replace(/^::ffff:/iu, "") ?? "";
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(address);
  if (v4) {
    const octets = v4.slice(1, 5).map(Number);
    if (octets.every((octet) => octet <= 255)) {
      return `${octets.slice(0, 3).join(".")}.0/24`;
    }
    return "unknown";
  }
  if (address.includes(":") && /^[0-9a-f:]+$/iu.test(address)) {
    const [head = "", tail = ""] = address.toLowerCase().split("::");
    const headGroups = head ? head.split(":") : [];
    const tailGroups = tail ? tail.split(":") : [];
    const missing = 8 - headGroups.length - tailGroups.length;
    if (missing < 0 || (!address.includes("::") && missing !== 0)) {
      return "unknown";
    }
    const groups = [
      ...headGroups,
      ...Array<string>(missing).fill("0"),
      ...tailGroups,
    ].map((group) => group.replace(/^0+(?=.)/u, ""));
    return `${groups.slice(0, 3).join(":")}::/48`;
  }
  return "unknown";
}

/** "Chrome on macOS", from a user-agent string. */
export function describeDevice(userAgent: string | null | undefined): string {
  const agent = userAgent ?? "";
  const browser = /Edg(?:e|A|iOS)?\//u.test(agent)
    ? "Edge"
    : /OPR\/|Opera/u.test(agent)
      ? "Opera"
      : /Firefox\/|FxiOS\//u.test(agent)
        ? "Firefox"
        : /Chrome\/|CriOS\/|HeadlessChrome\//u.test(agent)
          ? "Chrome"
          : /Safari\//u.test(agent) && /Version\//u.test(agent)
            ? "Safari"
            : null;
  const system = /iPhone|iPod/u.test(agent)
    ? "iOS"
    : /iPad/u.test(agent)
      ? "iPadOS"
      : /Android/u.test(agent)
        ? "Android"
        : /CrOS/u.test(agent)
          ? "ChromeOS"
          : /Windows/u.test(agent)
            ? "Windows"
            : /Mac OS X|Macintosh/u.test(agent)
              ? "macOS"
              : /Linux/u.test(agent)
                ? "Linux"
                : null;

  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
}

export type SignInFingerprint = { device: string; network: string };

/**
 * A sign-in is new when this device has not signed in from this network
 * before. The very first sign-in to an account is not treated as new.
 */
export function isNewSignIn(
  previous: SignInFingerprint[],
  current: SignInFingerprint,
): boolean {
  if (previous.length === 0) return false;
  return !previous.some(
    (entry) =>
      entry.device === current.device && entry.network === current.network,
  );
}

/** Whether repeated failures should email the account holder now. */
export function shouldAlertFailedAttempts(
  recentFailures: number,
  lastAlertAt: Date | null,
  now = new Date(),
): boolean {
  if (recentFailures < FAILED_ATTEMPT_ALERT_THRESHOLD) return false;
  return (
    lastAlertAt === null ||
    now.getTime() - lastAlertAt.getTime() >= ALERT_COOLDOWN_MS
  );
}
