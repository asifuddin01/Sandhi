import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  BREACHED_PASSWORD_MESSAGE,
  breachedPasswordProblem,
  isBreachedPassword,
} from "@/lib/breached-passwords";

const password = "correct horse battery staple";
const hash = createHash("sha1").update(password).digest("hex").toUpperCase();

function respond(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status }));
}

describe("isBreachedPassword", () => {
  it("sends only the five-character hash prefix, with padding", async () => {
    const fetcher = respond("");
    await isBreachedPassword(password, { fetcher });

    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
    );
    expect(url).not.toContain(hash.slice(5));
    expect(url).not.toContain(password);
    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe(
      "true",
    );
  });

  it("matches the rest of the hash against the returned list", async () => {
    const suffix = hash.slice(5);
    await expect(
      isBreachedPassword(password, {
        fetcher: respond(
          `0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${suffix}:391`,
        ),
      }),
    ).resolves.toBe(true);
    await expect(
      isBreachedPassword(password, {
        fetcher: respond("0018A45C4D1DEF81644B54AB7F969B88D65:3"),
      }),
    ).resolves.toBe(false);
    // Padding entries have a count of zero.
    await expect(
      isBreachedPassword(password, { fetcher: respond(`${suffix}:0`) }),
    ).resolves.toBe(false);
  });

  it("reports an unanswered check as unknown", async () => {
    await expect(
      isBreachedPassword(password, { fetcher: respond("", 503) }),
    ).resolves.toBeNull();
    await expect(
      isBreachedPassword(password, {
        fetcher: vi.fn(async () => {
          throw new TypeError("network down");
        }),
      }),
    ).resolves.toBeNull();
  });
});

describe("breachedPasswordProblem", () => {
  it("refuses a breached password and allows one when the check is down", async () => {
    const suffix = hash.slice(5);
    await expect(
      breachedPasswordProblem(password, { fetcher: respond(`${suffix}:5`) }),
    ).resolves.toBe(BREACHED_PASSWORD_MESSAGE);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      breachedPasswordProblem(password, { fetcher: respond("", 500) }),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
