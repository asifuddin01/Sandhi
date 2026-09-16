import { describe, expect, it, vi } from "vitest";

import { sendApplicationEmails, sendEmail } from "@/lib/email";
import { ServiceConfigurationError } from "@/lib/forms-services";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  assertPrivateUploadExists,
  createPrivateUploadIntent,
  verifyUploadReceipt,
} from "@/lib/storage";
import { verifyTurnstile } from "@/lib/turnstile";

const r2Environment = {
  NODE_ENV: "test",
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_PRIVATE: "private-files",
} as NodeJS.ProcessEnv;

describe("private upload intents", () => {
  it("creates a short-lived signed R2 URL and verifiable receipt", () => {
    const now = new Date("2026-09-16T10:00:00.000Z");
    const intent = createPrivateUploadIntent(
      { kind: "cv", size: 1024 },
      {
        env: r2Environment,
        now,
        randomId: () => "00000000-0000-4000-8000-000000000000",
      },
    );

    expect(intent.key).toBe(
      "applications/pending/00000000-0000-4000-8000-000000000000/cv.pdf",
    );
    expect(intent.uploadUrl).toContain(
      "account-id.r2.cloudflarestorage.com/private-files/",
    );
    expect(intent.uploadUrl).toContain("X-Amz-Signature=");
    expect(intent.uploadUrl).not.toContain("secret-key");
    expect(() =>
      verifyUploadReceipt(
        intent.uploadToken,
        { key: intent.key, kind: "cv" },
        { env: r2Environment, now },
      ),
    ).not.toThrow();
    expect(() =>
      verifyUploadReceipt(
        `${intent.uploadToken}x`,
        { key: intent.key, kind: "cv" },
        { env: r2Environment, now },
      ),
    ).toThrow();
  });

  it("verifies stored PDF metadata and magic bytes", async () => {
    const now = new Date("2026-09-16T10:00:00.000Z");
    const intent = createPrivateUploadIntent(
      { kind: "proposal", size: 9 },
      {
        env: r2Environment,
        now,
        randomId: () => "00000000-0000-4000-8000-000000000000",
      },
    );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            "Content-Length": "9",
            "Content-Type": "application/pdf",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response("%PDF-1.7\n", {
          status: 206,
          headers: { "Content-Type": "application/pdf" },
        }),
      );

    await expect(
      assertPrivateUploadExists(
        {
          key: intent.key,
          kind: "proposal",
          uploadToken: intent.uploadToken,
        },
        { env: r2Environment, now, fetcher },
      ),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "GET",
      headers: { Range: "bytes=0-1023" },
    });
  });

  it("rejects an uploaded file without a PDF signature", async () => {
    const now = new Date("2026-09-16T10:00:00.000Z");
    const intent = createPrivateUploadIntent(
      { kind: "cv", size: 9 },
      {
        env: r2Environment,
        now,
        randomId: () => "00000000-0000-4000-8000-000000000001",
      },
    );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            "Content-Length": "9",
            "Content-Type": "application/pdf",
          },
        }),
      )
      .mockResolvedValueOnce(new Response("not-a-pdf", { status: 206 }));

    await expect(
      assertPrivateUploadExists(
        {
          key: intent.key,
          kind: "cv",
          uploadToken: intent.uploadToken,
        },
        { env: r2Environment, now, fetcher },
      ),
    ).rejects.toThrow("valid PDF signature");
  });
});

describe("public form service guards", () => {
  it("fails closed when production Turnstile credentials are absent", async () => {
    await expect(
      verifyTurnstile(
        { token: "anything" },
        { env: { NODE_ENV: "production" } as NodeJS.ProcessEnv },
      ),
    ).rejects.toBeInstanceOf(ServiceConfigurationError);
  });

  it("allows only the explicit Turnstile development bypass without credentials", async () => {
    await expect(
      verifyTurnstile(
        { token: "development-bypass" },
        { env: { NODE_ENV: "test" } as NodeJS.ProcessEnv },
      ),
    ).resolves.toMatchObject({ success: true, mode: "development-bypass" });
    await expect(
      verifyTurnstile(
        { token: "made-up" },
        { env: { NODE_ENV: "test" } as NodeJS.ProcessEnv },
      ),
    ).resolves.toMatchObject({ success: false });
  });

  it("interprets an Upstash pipeline response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ result: 2 }, { result: 1 }, { result: 3600 }]),
          { status: 200 },
        ),
      );
    const decision = await checkRateLimit(
      {
        scope: "contact-submit",
        identifier: "hashed-client",
        limit: 5,
        windowSeconds: 3600,
      },
      {
        env: {
          NODE_ENV: "test",
          UPSTASH_REDIS_REST_URL: "https://redis.example.test",
          UPSTASH_REDIS_REST_TOKEN: "token",
        } as NodeJS.ProcessEnv,
        fetcher,
      },
    );

    expect(decision).toMatchObject({
      allowed: true,
      remaining: 3,
      mode: "upstash",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("uses a no-send development email adapter and fails closed in production", async () => {
    await expect(
      sendEmail(
        {
          to: "person@example.org",
          subject: "Test",
          text: "Test",
          html: "<p>Test</p>",
        },
        { env: { NODE_ENV: "test" } as NodeJS.ProcessEnv },
      ),
    ).resolves.toMatchObject({ mode: "development-bypass" });

    await expect(
      sendEmail(
        {
          to: "person@example.org",
          subject: "Test",
          text: "Test",
          html: "<p>Test</p>",
        },
        { env: { NODE_ENV: "production" } as NodeJS.ProcessEnv },
      ),
    ).rejects.toBeInstanceOf(ServiceConfigurationError);
  });

  it("sends separate applicant and admin application emails", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ id: "applicant-message-id" }, { status: 200 }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "admin-message-id" }, { status: 200 }),
      );
    const deliveries = await sendApplicationEmails(
      {
        id: "fixture-application-id",
        type: "ACADEMIC_COLLABORATION",
        name: "Fixture Collaborator",
        email: "collaborator@example.org",
        phone: "",
        institution: "Fixture University",
        currentRole: "Researcher",
        interests: ["causal-inference"],
        scholarUrl: "",
        orcid: "",
        githubUrl: "",
        linkedinUrl: "",
        websiteUrl: "",
        motivation: "A meaningful research motivation. ".repeat(6),
        experience: "",
        proposalTitle: "Fixture collaboration",
        proposalSummary:
          "A fixture collaboration summary long enough for server validation.",
        hoursPerWeek: "",
        consent: true,
        turnstileToken: "verified-token",
      },
      "join@sandhiresearch.org",
      {
        env: {
          NODE_ENV: "test",
          RESEND_API_KEY: "test-key",
          EMAIL_FROM: "SANDHI Research Lab <no-reply@sandhiresearch.org>",
        } as NodeJS.ProcessEnv,
        fetcher,
      },
    );

    expect(deliveries).toEqual([
      { id: "applicant-message-id", mode: "resend" },
      { id: "admin-message-id", mode: "resend" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await fetcher.mock.calls[0]?.[1]?.body).toContain(
      '"to":"collaborator@example.org"',
    );
    expect(await fetcher.mock.calls[1]?.[1]?.body).toContain(
      '"to":"join@sandhiresearch.org"',
    );
  });
});
