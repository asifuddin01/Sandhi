import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  ExternalServiceError,
  ServiceConfigurationError,
} from "@/lib/forms-services";

type Fetcher = typeof fetch;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

type UploadReceipt = {
  version: 1;
  key: string;
  kind: "cv" | "proposal";
  size: number;
  expiresAt: number;
};

export type PrivateUploadIntent = {
  uploadUrl: string;
  key: string;
  uploadToken: string;
  expiresAt: string;
};

function r2Config(env: NodeJS.ProcessEnv): R2Config {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET_PRIVATE?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new ServiceConfigurationError(
      "R2",
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_PRIVATE are required.",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalPath(bucket: string, key: string): string {
  return `/${[bucket, ...key.split("/")].map(encode).join("/")}`;
}

function presignedR2Url(
  method: "PUT" | "HEAD" | "GET",
  key: string,
  config: R2Config,
  now: Date,
  expiresSeconds = 600,
): string {
  const dateTime = amzDate(now);
  const date = dateTime.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const scope = `${date}/${region}/${service}/aws4_request`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = canonicalPath(config.bucket, key);
  const parameters = new Map([
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${scope}`],
    ["X-Amz-Date", dateTime],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ]);
  const query = [...parameters.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .join("&");
  const canonicalRequest = [
    method,
    path,
    query,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateTime,
    scope,
    hash(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return `https://${host}${path}?${query}&X-Amz-Signature=${signature}`;
}

function signReceipt(receipt: UploadReceipt, secret: string): string {
  const payload = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyUploadReceipt(
  token: string,
  expected: { key: string; kind: "cv" | "proposal" },
  options: { env?: NodeJS.ProcessEnv; now?: Date } = {},
): UploadReceipt {
  const config = r2Config(options.env ?? process.env);
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) {
    throw new ExternalServiceError("R2", "The upload receipt is invalid.");
  }

  const expectedSignature = createHmac("sha256", config.secretAccessKey)
    .update(payload)
    .digest("base64url");
  const expectedBytes = Buffer.from(expectedSignature);
  const providedBytes = Buffer.from(providedSignature);

  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    throw new ExternalServiceError("R2", "The upload receipt is invalid.");
  }

  let receipt: UploadReceipt;
  try {
    receipt = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as UploadReceipt;
  } catch {
    throw new ExternalServiceError("R2", "The upload receipt is invalid.");
  }

  if (
    receipt.version !== 1 ||
    receipt.key !== expected.key ||
    receipt.kind !== expected.kind ||
    receipt.expiresAt < (options.now ?? new Date()).getTime()
  ) {
    throw new ExternalServiceError(
      "R2",
      "The upload receipt is invalid or expired.",
    );
  }

  return receipt;
}

export function createPrivateUploadIntent(
  input: { kind: "cv" | "proposal"; size: number },
  options: {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    randomId?: () => string;
  } = {},
): PrivateUploadIntent {
  const env = options.env ?? process.env;
  const config = r2Config(env);
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const id = (options.randomId ?? randomUUID)();
  const key = `applications/pending/${id}/${input.kind}.pdf`;
  const receipt: UploadReceipt = {
    version: 1,
    key,
    kind: input.kind,
    size: input.size,
    expiresAt: expiresAt.getTime(),
  };

  return {
    uploadUrl: presignedR2Url("PUT", key, config, now),
    key,
    uploadToken: signReceipt(receipt, config.secretAccessKey),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function assertPrivateUploadExists(
  input: {
    key: string;
    kind: "cv" | "proposal";
    uploadToken: string;
  },
  dependencies: {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    fetcher?: Fetcher;
  } = {},
): Promise<void> {
  const env = dependencies.env ?? process.env;
  const now = dependencies.now ?? new Date();
  const receipt = verifyUploadReceipt(input.uploadToken, input, { env, now });
  const maximumBytes = (input.kind === "proposal" ? 10 : 5) * 1024 * 1024;
  if (receipt.size <= 0 || receipt.size > maximumBytes) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded ${input.kind === "proposal" ? "proposal" : "CV"} exceeds its size limit.`,
    );
  }
  const config = r2Config(env);
  const headUrl = presignedR2Url("HEAD", input.key, config, now, 60);

  let response: Response;
  try {
    response = await (dependencies.fetcher ?? fetch)(headUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded file could not be checked: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      "R2",
      response.status === 404
        ? "The uploaded file was not found."
        : `The uploaded file could not be checked (HTTP ${response.status}).`,
    );
  }

  const storedType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (storedType !== "application/pdf") {
    throw new ExternalServiceError(
      "R2",
      "The uploaded file is not stored as a PDF.",
    );
  }

  const storedLength = Number(response.headers.get("content-length"));
  if (
    !Number.isSafeInteger(storedLength) ||
    storedLength !== receipt.size ||
    storedLength > maximumBytes
  ) {
    throw new ExternalServiceError(
      "R2",
      "The uploaded file size does not match the validated upload.",
    );
  }

  const rangeUrl = presignedR2Url("GET", input.key, config, now, 60);
  let prefixResponse: Response;
  try {
    prefixResponse = await (dependencies.fetcher ?? fetch)(rangeUrl, {
      method: "GET",
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded file signature could not be checked: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }

  if (!prefixResponse.ok) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded file signature could not be checked (HTTP ${prefixResponse.status}).`,
    );
  }

  const prefix = new Uint8Array(await prefixResponse.arrayBuffer()).slice(
    0,
    1024,
  );
  const pdfSignature = new TextEncoder().encode("%PDF-");
  const signatureFound = prefix.some((_, start) =>
    pdfSignature.every((byte, offset) => prefix[start + offset] === byte),
  );
  if (!signatureFound) {
    throw new ExternalServiceError(
      "R2",
      "The uploaded file does not contain a valid PDF signature.",
    );
  }
}
