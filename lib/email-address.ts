/** The longest address SMTP allows (RFC 5321, forward path). */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Domain labels exclude dots, so no two ways of matching overlap and the
 * pattern runs in linear time; the looser `[^@]+\.[^@]+` form backtracks
 * quadratically, and took seconds on one crafted sign-in field.
 */
const emailPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;

/** Length is checked before the pattern runs, so input size is bounded too. */
export function isEmailAddress(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && emailPattern.test(value);
}
