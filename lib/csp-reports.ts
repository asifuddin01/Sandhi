/** Where browsers send Content Security Policy violation reports. */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp-endpoint";
export const MAX_CSP_REPORT_BYTES = 16 * 1024;

export type CspViolation = {
  directive: string;
  /** An origin, or a keyword such as "inline" or "eval": never a full URL. */
  blocked: string;
  /** Path only: queries can hold reset or invitation tokens. */
  page: string;
  source: string | null;
  line: number | null;
  disposition: string;
};

const MAX_REPORTS = 10;

function text(value: unknown, max = 120): string | null {
  return typeof value === "string" && value ? value.slice(0, max) : null;
}

function pathOf(value: unknown): string {
  const raw = text(value, 500);
  if (!raw) return "unknown";
  try {
    return new URL(raw).pathname.slice(0, 200);
  } catch {
    return "unknown";
  }
}

function originOrKeyword(value: unknown): string {
  const raw = text(value, 500);
  if (!raw) return "unknown";
  if (/^[a-z-]+$/u.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : url.protocol.replace(":", "");
  } catch {
    return "unknown";
  }
}

function sourceOf(value: unknown): string | null {
  const raw = text(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 200);
  } catch {
    return null;
  }
}

function violation(
  body: Record<string, unknown>,
  legacy: boolean,
): CspViolation {
  const pick = (modern: string, old: string) => body[legacy ? old : modern];
  const line = pick("lineNumber", "line-number");
  return {
    directive:
      text(pick("effectiveDirective", "effective-directive"), 60) ??
      text(body["violated-directive"], 60) ??
      "unknown",
    blocked: originOrKeyword(pick("blockedURL", "blocked-uri")),
    page: pathOf(pick("documentURL", "document-uri")),
    source: sourceOf(pick("sourceFile", "source-file")),
    line: typeof line === "number" && Number.isFinite(line) ? line : null,
    disposition: text(body.disposition, 20) ?? "enforce",
  };
}

/**
 * Reads both report formats: the legacy `{ "csp-report": … }` body and the
 * Reporting API's array of `{ type: "csp-violation", body }`. Anything else
 * is ignored, and at most ten reports are kept from one request.
 */
export function summarizeCspReports(payload: unknown): CspViolation[] {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const legacy = (payload as Record<string, unknown>)["csp-report"];
    return legacy && typeof legacy === "object"
      ? [violation(legacy as Record<string, unknown>, true)]
      : [];
  }
  if (!Array.isArray(payload)) return [];
  return payload
    .filter(
      (report): report is { type: string; body: Record<string, unknown> } =>
        Boolean(report) &&
        typeof report === "object" &&
        (report as { type?: unknown }).type === "csp-violation" &&
        typeof (report as { body?: unknown }).body === "object" &&
        (report as { body?: unknown }).body !== null,
    )
    .slice(0, MAX_REPORTS)
    .map((report) => violation(report.body, false));
}
