import { describe, expect, it, vi } from "vitest";

import {
  acceptFor,
  attachmentUploadSchema,
  humanSize,
} from "@/lib/portal/attachment-input";
import {
  assertAttachmentExists,
  createAttachmentUploadIntent,
} from "@/lib/storage";

const env = {
  R2_ACCOUNT_ID: "a1b2c3",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_PRIVATE: "sandhi-private",
} as unknown as NodeJS.ProcessEnv;

const now = new Date("2026-09-20T00:00:00.000Z");

function intent(kind: "figure" | "document" | "data", contentType: string) {
  return createAttachmentUploadIntent(
    { kind, contentType, size: 1024 },
    { env, now, randomId: () => "fixed-id" },
  );
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function responses(options: {
  length?: number;
  prefix?: number[];
  headOk?: boolean;
}) {
  const { length = 1024, prefix = PNG_HEADER, headOk = true } = options;
  return vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "HEAD") {
      return new Response(null, {
        status: headOk ? 200 : 404,
        headers: { "content-length": String(length) },
      });
    }
    return new Response(new Uint8Array(prefix), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("an upload slot for an attachment", () => {
  it("puts the object under its own prefix, with the format's extension", () => {
    expect(intent("figure", "image/png").key).toBe(
      "projects/updates/fixed-id/figure.png",
    );
    expect(intent("data", "text/csv").key).toBe(
      "projects/updates/fixed-id/data.csv",
    );
    expect(intent("document", "application/pdf").key).toBe(
      "projects/updates/fixed-id/document.pdf",
    );
  });

  it("signs the upload against private storage, not the public bucket", () => {
    const { uploadUrl } = intent("figure", "image/png");
    expect(uploadUrl).toContain("a1b2c3.r2.cloudflarestorage.com");
    expect(uploadUrl).toContain("sandhi-private");
    expect(uploadUrl).toContain("X-Amz-Signature=");
  });

  it("refuses a format the kind does not accept", () => {
    // SVG is a document that can carry script, and figures are shown inline.
    expect(() => intent("figure", "image/svg+xml")).toThrow(
      /not accepted as a figure/u,
    );
    expect(() => intent("data", "application/pdf")).toThrow(
      /not accepted as a data file/u,
    );
  });

  it("refuses a file over its kind's ceiling", () => {
    expect(() =>
      createAttachmentUploadIntent(
        { kind: "figure", contentType: "image/png", size: 9 * 1024 * 1024 },
        { env, now },
      ),
    ).toThrow(/under 8 MB/u);
  });
});

describe("confirming an attachment arrived", () => {
  const valid = intent("figure", "image/png");

  it("accepts an object of the declared type, size and signature", async () => {
    await expect(
      assertAttachmentExists(
        {
          key: valid.key,
          kind: "figure",
          contentType: "image/png",
          uploadToken: valid.uploadToken,
        },
        { env, now, fetcher: responses({}) },
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses a receipt minted for another object", async () => {
    await expect(
      assertAttachmentExists(
        {
          key: "projects/updates/someone-else/figure.png",
          kind: "figure",
          contentType: "image/png",
          uploadToken: valid.uploadToken,
        },
        { env, now, fetcher: responses({}) },
      ),
    ).rejects.toThrow(/receipt is invalid/u);
  });

  it("refuses bytes that are not the format they claim to be", async () => {
    // A PDF renamed to .png would otherwise be served with an image type.
    await expect(
      assertAttachmentExists(
        {
          key: valid.key,
          kind: "figure",
          contentType: "image/png",
          uploadToken: valid.uploadToken,
        },
        {
          env,
          now,
          fetcher: responses({ prefix: [0x25, 0x50, 0x44, 0x46, 0x2d] }),
        },
      ),
    ).rejects.toThrow(/not a valid PNG/u);
  });

  it("refuses an object whose size is not the size that was validated", async () => {
    await expect(
      assertAttachmentExists(
        {
          key: valid.key,
          kind: "figure",
          contentType: "image/png",
          uploadToken: valid.uploadToken,
        },
        { env, now, fetcher: responses({ length: 4096 }) },
      ),
    ).rejects.toThrow(/size does not match/u);
  });

  it("refuses an object that is not there", async () => {
    await expect(
      assertAttachmentExists(
        {
          key: valid.key,
          kind: "figure",
          contentType: "image/png",
          uploadToken: valid.uploadToken,
        },
        { env, now, fetcher: responses({ headOk: false }) },
      ),
    ).rejects.toThrow(/could not be confirmed/u);
  });

  it("checks nothing beyond the receipt for formats with no signature", async () => {
    const csv = intent("data", "text/csv");
    await expect(
      assertAttachmentExists(
        {
          key: csv.key,
          kind: "data",
          contentType: "text/csv",
          uploadToken: csv.uploadToken,
        },
        { env, now, fetcher: responses({}) },
      ),
    ).resolves.toBeUndefined();
  });
});

describe("what the browser may ask for", () => {
  it("accepts a figure within its limits", () => {
    expect(
      attachmentUploadSchema.safeParse({
        projectSlug: "quiet-signals",
        kind: "figure",
        contentType: "image/png",
        size: 1024,
      }).success,
    ).toBe(true);
  });

  it("refuses a type or a size the kind does not allow", () => {
    expect(
      attachmentUploadSchema.safeParse({
        projectSlug: "quiet-signals",
        kind: "figure",
        contentType: "image/svg+xml",
        size: 1024,
      }).success,
    ).toBe(false);
    expect(
      attachmentUploadSchema.safeParse({
        projectSlug: "quiet-signals",
        kind: "data",
        contentType: "text/csv",
        size: 21 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });

  it("offers the picker exactly the types the server will take", () => {
    expect(acceptFor("figure")).toBe("image/png,image/jpeg,image/webp");
  });
});

describe("file sizes people read", () => {
  it("reads in the unit that suits the number", () => {
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(1024 * 1024 * 3.5)).toBe("3.5 MB");
    expect(humanSize(1024 * 1024 * 12)).toBe("12 MB");
  });
});
