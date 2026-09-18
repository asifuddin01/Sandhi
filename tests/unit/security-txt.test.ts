import { describe, expect, it } from "vitest";

import { buildSecurityTxt } from "@/lib/security-txt";

describe("buildSecurityTxt", () => {
  it("lists the contact, a future expiry within a year, and its own address", () => {
    const now = new Date("2026-09-19T00:00:00Z");
    const text = buildSecurityTxt({
      contact: "contact@sandhiresearch.org",
      origin: "https://sandhiresearch.org",
      now,
    });

    expect(text.split("\n")).toEqual([
      "Contact: mailto:contact@sandhiresearch.org",
      "Expires: 2027-03-18T00:00:00.000Z",
      "Preferred-Languages: en",
      "Canonical: https://sandhiresearch.org/.well-known/security.txt",
      "",
    ]);
    const expires = new Date(/Expires: (.+)/u.exec(text)![1]!);
    expect(expires.getTime()).toBeGreaterThan(now.getTime());
    expect(expires.getTime() - now.getTime()).toBeLessThan(
      365 * 24 * 60 * 60 * 1000,
    );
  });
});
