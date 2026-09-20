import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertPortraitExists,
  createPortraitUploadIntent,
  isPortraitUploadConfigured,
  portraitPrefix,
} from "@/lib/storage";

/**
 * Every credential below is invented. The signing is real; the account is not.
 */
const env = {
  R2_ACCOUNT_ID: "fixture-account",
  R2_ACCESS_KEY_ID: "fixture-key-id",
  R2_SECRET_ACCESS_KEY: "fixture-secret",
  R2_BUCKET_PUBLIC: "fixture-public",
  R2_BUCKET_PRIVATE: "fixture-private",
} as unknown as NodeJS.ProcessEnv;

const now = new Date("2026-09-20T09:00:00.000Z");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function intent(memberId = "member-1", contentType = "image/png") {
  return createPortraitUploadIntent(
    { memberId, contentType, size: png.length },
    { env, now, randomId: () => "fixture-id" },
  );
}

describe("createPortraitUploadIntent", () => {
  it("files the object under the member it was minted for", () => {
    expect(intent().key).toBe("members/member-1/fixture-id.png");
    expect(portraitPrefix("member-1")).toBe("members/member-1/");
  });

  it("uses the public bucket, because a portrait is shown on a public page", () => {
    expect(intent().uploadUrl).toContain("/fixture-public/");
    expect(intent().uploadUrl).not.toContain("fixture-private");
  });

  it("refuses a file that is not one of the three image types", () => {
    expect(() => intent("member-1", "image/svg+xml")).toThrow(/PNG, JPEG/u);
    expect(() => intent("member-1", "application/pdf")).toThrow(/PNG, JPEG/u);
  });

  it("refuses an oversized image before anything is uploaded", () => {
    expect(() =>
      createPortraitUploadIntent(
        { memberId: "member-1", contentType: "image/png", size: 9_000_000 },
        { env, now },
      ),
    ).toThrow(/under 5 MB/u);
  });

  it("reports whether portraits are possible at all", () => {
    expect(isPortraitUploadConfigured(env)).toBe(true);
    expect(
      isPortraitUploadConfigured({ ...env, R2_BUCKET_PUBLIC: undefined }),
    ).toBe(false);
  });
});

describe("assertPortraitExists", () => {
  function storage(bytes = png, length = png.length) {
    return vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "HEAD"
        ? new Response(null, {
            headers: { "content-length": String(length) },
          })
        : new Response(bytes),
    ) as unknown as typeof fetch;
  }

  const good = intent();

  it("accepts an image that arrived as described", async () => {
    await expect(
      assertPortraitExists(
        {
          key: good.key,
          memberId: "member-1",
          contentType: "image/png",
          uploadToken: good.uploadToken,
        },
        { env, now, fetcher: storage() },
      ),
    ).resolves.toBeUndefined();
  });

  /**
   * The receipt is valid — it is this person's own. The key belongs to
   * somebody else. Without the prefix check, a member could overwrite a
   * colleague's photograph with their own receipt.
   */
  it("refuses a valid receipt spent on another member's key", async () => {
    await expect(
      assertPortraitExists(
        {
          key: "members/someone-else/fixture-id.png",
          memberId: "member-1",
          contentType: "image/png",
          uploadToken: good.uploadToken,
        },
        { env, now, fetcher: storage() },
      ),
    ).rejects.toThrow(/not yours/u);
  });

  it("refuses a receipt that was not signed by us", async () => {
    await expect(
      assertPortraitExists(
        {
          key: good.key,
          memberId: "member-1",
          contentType: "image/png",
          uploadToken: `${good.uploadToken.split(".")[0]}.forged`,
        },
        { env, now, fetcher: storage() },
      ),
    ).rejects.toThrow(/receipt is invalid/u);
  });

  it("refuses a receipt whose ten minutes have passed", async () => {
    await expect(
      assertPortraitExists(
        {
          key: good.key,
          memberId: "member-1",
          contentType: "image/png",
          uploadToken: good.uploadToken,
        },
        {
          env,
          now: new Date(now.getTime() + 11 * 60 * 1000),
          fetcher: storage(),
        },
      ),
    ).rejects.toThrow(/invalid or expired/u);
  });

  it("refuses bytes that are not the image type they claim to be", async () => {
    const script = new TextEncoder().encode("<svg onload=alert(1)>");
    await expect(
      assertPortraitExists(
        {
          key: good.key,
          memberId: "member-1",
          contentType: "image/png",
          uploadToken: good.uploadToken,
        },
        { env, now, fetcher: storage(script, png.length) },
      ),
    ).rejects.toThrow(/not the image type it claims/u);
  });

  it("refuses an object whose stored size is not the size we validated", async () => {
    await expect(
      assertPortraitExists(
        {
          key: good.key,
          memberId: "member-1",
          contentType: "image/png",
          uploadToken: good.uploadToken,
        },
        { env, now, fetcher: storage(png, 4_000_000) },
      ),
    ).rejects.toThrow(/does not match the validated upload/u);
  });
});
