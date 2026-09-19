import { beforeEach, describe, expect, it, vi } from "vitest";

import { summarizeCspReports } from "@/lib/csp-reports";

const mocks = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }));

import { POST } from "@/app/api/csp-report/route";

describe("summarizeCspReports", () => {
  it("reads the legacy report format without keeping query strings", () => {
    expect(
      summarizeCspReports({
        "csp-report": {
          "document-uri":
            "https://sandhiresearch.org/portal/reset-password?token=secret",
          "violated-directive": "script-src-elem",
          "effective-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js?steal=1",
          "source-file": "https://sandhiresearch.org/_next/app.js?v=2",
          "line-number": 12,
          disposition: "enforce",
        },
      }),
    ).toEqual([
      {
        directive: "script-src-elem",
        blocked: "https://evil.example",
        page: "/portal/reset-password",
        source: "https://sandhiresearch.org/_next/app.js",
        line: 12,
        disposition: "enforce",
      },
    ]);
  });

  it("reads the Reporting API format and keywords for inline code", () => {
    const [report] = summarizeCspReports([
      {
        type: "csp-violation",
        body: {
          documentURL: "https://sandhiresearch.org/join?step=2",
          effectiveDirective: "script-src-attr",
          blockedURL: "inline",
          disposition: "enforce",
        },
      },
      { type: "deprecation", body: { message: "ignored" } },
    ]);
    expect(report).toMatchObject({
      directive: "script-src-attr",
      blocked: "inline",
      page: "/join",
      source: null,
      line: null,
    });
  });

  it("ignores anything else and keeps at most ten reports", () => {
    expect(summarizeCspReports(null)).toEqual([]);
    expect(summarizeCspReports("text")).toEqual([]);
    expect(summarizeCspReports({ other: {} })).toEqual([]);
    const many = Array.from({ length: 50 }, () => ({
      type: "csp-violation",
      body: { effectiveDirective: "img-src", blockedURL: "data" },
    }));
    expect(summarizeCspReports(many)).toHaveLength(10);
  });
});

describe("CSP report endpoint", () => {
  const report = JSON.stringify({
    "csp-report": {
      "document-uri": "https://sandhiresearch.org/",
      "effective-directive": "script-src",
      "blocked-uri": "inline",
    },
  });
  const post = (body: string, headers: Record<string, string> = {}) =>
    POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "Content-Type": "application/csp-report", ...headers },
        body,
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("logs a violation briefly and answers 204", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await post(report);
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith(
      "[csp] violation",
      expect.stringContaining('"blocked":"inline"'),
    );
    warn.mockRestore();
  });

  it("refuses oversized and malformed bodies", async () => {
    expect((await post("x".repeat(20_000))).status).toBe(413);
    expect((await post("{}", { "Content-Length": "999999" })).status).toBe(413);
    expect((await post("not json")).status).toBe(400);
  });

  it("stops logging once a client exceeds its limit, or without a limiter", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    expect((await post(report)).status).toBe(204);
    mocks.checkRateLimit.mockRejectedValueOnce(new Error("no limiter"));
    expect((await post(report)).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
