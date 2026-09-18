import { describe, expect, it } from "vitest";

import {
  authSecretProblem,
  databaseUrlProblem,
  MIN_AUTH_SECRET_LENGTH,
} from "@/lib/production-config";

const production = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
const vercelProduction = {
  NODE_ENV: "development",
  VERCEL_ENV: "production",
} as NodeJS.ProcessEnv;
const development = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

describe("databaseUrlProblem", () => {
  const remote =
    "postgresql://app:pw@ep-cool.eu-central-1.aws.neon.tech/sandhi";

  it("requires TLS for a remote database in production", () => {
    expect(databaseUrlProblem(remote, production)).toMatch(/sslmode=require/u);
    expect(databaseUrlProblem(remote, vercelProduction)).not.toBeNull();
    expect(
      databaseUrlProblem(`${remote}?sslmode=disable`, production),
    ).not.toBeNull();
    expect(
      databaseUrlProblem(`${remote}?sslmode=prefer`, production),
    ).not.toBeNull();
  });

  it("accepts TLS modes that refuse a plaintext connection", () => {
    for (const mode of ["require", "verify-ca", "VERIFY-FULL"]) {
      expect(
        databaseUrlProblem(`${remote}?sslmode=${mode}`, production),
      ).toBeNull();
    }
  });

  it("allows local databases and any database outside production", () => {
    expect(
      databaseUrlProblem("postgresql://me@localhost:5432/sandhi", production),
    ).toBeNull();
    expect(
      databaseUrlProblem("postgresql://me@127.0.0.1/sandhi", production),
    ).toBeNull();
    expect(databaseUrlProblem("postgresql://me@[::1]/sandhi", production)).toBe(
      null,
    );
    expect(databaseUrlProblem(remote, development)).toBeNull();
  });

  it("rejects an unparseable connection string in production", () => {
    expect(databaseUrlProblem("not a url", production)).toMatch(/valid/u);
  });
});

describe("authSecretProblem", () => {
  it("requires a long secret in production only", () => {
    expect(authSecretProblem(undefined, production)).toMatch(/openssl/u);
    expect(authSecretProblem("short", production)).not.toBeNull();
    expect(
      authSecretProblem(" ".repeat(MIN_AUTH_SECRET_LENGTH), production),
    ).not.toBeNull();
    expect(
      authSecretProblem("x".repeat(MIN_AUTH_SECRET_LENGTH), production),
    ).toBeNull();
    expect(authSecretProblem(undefined, development)).toBeNull();
  });
});
