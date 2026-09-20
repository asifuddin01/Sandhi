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
import {
  ATTACHMENT_RULES,
  attachmentExtension,
  type AttachmentUploadKind,
} from "@/lib/portal/attachment-input";
import {
  PORTRAIT_RULES,
  portraitExtension,
} from "@/lib/portal/profile-fields";

type Fetcher = typeof fetch;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/**
 * What a private upload is for. The kind decides the key prefix, the accepted
 * media types and the size ceiling, and it is signed into the receipt so a
 * caller cannot present a small figure's token for a large dataset.
 */
export type UploadKind =
  | "cv"
  | "proposal"
  | "figure"
  | "document"
  | "data"
  | "portrait";

type UploadReceipt = {
  version: 1;
  key: string;
  kind: UploadKind;
  size: number;
  expiresAt: number;
};

export type PrivateUploadIntent = {
  uploadUrl: string;
  key: string;
  uploadToken: string;
  expiresAt: string;
};

function r2Config(
  env: NodeJS.ProcessEnv,
  bucketVariable: "R2_BUCKET_PRIVATE" | "R2_BUCKET_PUBLIC" = "R2_BUCKET_PRIVATE",
): R2Config {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env[bucketVariable]?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new ServiceConfigurationError(
      "R2",
      `R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and ${bucketVariable} are required.`,
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/**
 * Which bucket an upload of this kind belongs in. A portrait is a picture on
 * a public page, so it goes to the public bucket and is served straight from
 * it; everything else is private and reached only through a signed link our
 * own code decides to hand out.
 */
function bucketFor(kind: UploadKind): "R2_BUCKET_PRIVATE" | "R2_BUCKET_PUBLIC" {
  return kind === "portrait" ? "R2_BUCKET_PUBLIC" : "R2_BUCKET_PRIVATE";
}

/**
 * Whether portraits can be uploaded at all. A lab that has not connected
 * object storage yet still gets the rest of the profile form, with the
 * picture field explaining itself rather than failing when it is used.
 */
export function isPortraitUploadConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    r2Config(env, "R2_BUCKET_PUBLIC");
    return true;
  } catch {
    return false;
  }
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
  expected: { key: string; kind: UploadKind },
  options: { env?: NodeJS.ProcessEnv; now?: Date } = {},
): UploadReceipt {
  const config = r2Config(options.env ?? process.env, bucketFor(expected.kind));
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

/**
 * An upload slot for one file attached to a progress update. The object lands
 * in the same private bucket as everything else: an attachment is exactly as
 * public as the update that carries it, which our own code decides on every
 * read, so nothing here is ever world-readable by virtue of where it sits.
 */
export function createAttachmentUploadIntent(
  input: {
    kind: AttachmentUploadKind;
    contentType: string;
    size: number;
  },
  options: {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    randomId?: () => string;
  } = {},
): PrivateUploadIntent {
  const rules = ATTACHMENT_RULES[input.kind];
  const extension = attachmentExtension(input.kind, input.contentType);
  if (!extension) {
    throw new ExternalServiceError(
      "R2",
      `That file type is not accepted as a ${rules.label}.`,
    );
  }
  if (input.size <= 0 || input.size > rules.maximumBytes) {
    throw new ExternalServiceError(
      "R2",
      `A ${rules.label} must be under ${Math.round(rules.maximumBytes / (1024 * 1024))} MB.`,
    );
  }

  const env = options.env ?? process.env;
  const config = r2Config(env);
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const id = (options.randomId ?? randomUUID)();
  const key = `projects/updates/${id}/${input.kind}.${extension}`;
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

/** How long a private download link works: long enough to open, not to share. */
export const PRIVATE_DOWNLOAD_SECONDS = 600;

/**
 * A short-lived link to one private object. The key is never taken from a
 * request: callers pass a key they read from a record the viewer is allowed to
 * see, so the link is the last step of an authorization decision, not the
 * decision itself.
 */
export function createPrivateDownloadUrl(
  key: string,
  options: {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    expiresSeconds?: number;
  } = {},
): string {
  const config = r2Config(options.env ?? process.env);
  return presignedR2Url(
    "GET",
    key,
    config,
    options.now ?? new Date(),
    options.expiresSeconds ?? PRIVATE_DOWNLOAD_SECONDS,
  );
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

/** The first bytes each accepted attachment format must begin with. */
const MAGIC: Partial<Record<string, readonly number[][]>> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  // RIFF....WEBP: the size sits between, so the two runs are checked apart.
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]],
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Confirms an attachment really arrived, is the type and size that was
 * validated, and — for the formats that have one — begins with that format's
 * signature. A declared media type is a claim by the browser; the stored
 * bytes are the thing that will be served back.
 */
export async function assertAttachmentExists(
  input: {
    key: string;
    kind: AttachmentUploadKind;
    contentType: string;
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
  const fetcher = dependencies.fetcher ?? fetch;
  const rules = ATTACHMENT_RULES[input.kind];

  if (!(rules.types as readonly string[]).includes(input.contentType)) {
    throw new ExternalServiceError(
      "R2",
      `That file type is not accepted as a ${rules.label}.`,
    );
  }

  const receipt = verifyUploadReceipt(input.uploadToken, input, { env, now });
  if (receipt.size <= 0 || receipt.size > rules.maximumBytes) {
    throw new ExternalServiceError(
      "R2",
      `That ${rules.label} exceeds its size limit.`,
    );
  }

  const config = r2Config(env);
  let head: Response;
  try {
    head = await fetcher(presignedR2Url("HEAD", input.key, config, now, 60), {
      method: "HEAD",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw new ExternalServiceError(
      "R2",
      `The upload could not be confirmed: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }
  if (!head.ok) {
    throw new ExternalServiceError(
      "R2",
      `The upload could not be confirmed (HTTP ${head.status}).`,
    );
  }

  const storedLength = Number(head.headers.get("content-length"));
  if (!Number.isSafeInteger(storedLength) || storedLength !== receipt.size) {
    throw new ExternalServiceError(
      "R2",
      "The uploaded file size does not match the validated upload.",
    );
  }

  const signatures = MAGIC[input.contentType];
  if (!signatures) return;

  let prefixResponse: Response;
  try {
    prefixResponse = await fetcher(
      presignedR2Url("GET", input.key, config, now, 60),
      {
        method: "GET",
        headers: { Range: "bytes=0-15" },
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch (error) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded file could not be checked: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }
  if (!prefixResponse.ok) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded file could not be checked (HTTP ${prefixResponse.status}).`,
    );
  }

  const prefix = new Uint8Array(await prefixResponse.arrayBuffer());
  const matches = signatures.some((signature) => startsWith(prefix, signature));
  const webpTail =
    input.contentType !== "image/webp" ||
    startsWith(prefix.slice(8), [0x57, 0x45, 0x42, 0x50]);
  if (!matches || !webpTail) {
    throw new ExternalServiceError(
      "R2",
      `That file is not a valid ${input.contentType.split("/")[1]?.toUpperCase() ?? "file"}.`,
    );
  }
}

/**
 * An upload slot for one person's portrait. The key carries the member id, so
 * a receipt minted for one person cannot be spent on another's profile — the
 * action that writes `photoKey` checks the prefix.
 */
export function createPortraitUploadIntent(
  input: { memberId: string; contentType: string; size: number },
  options: {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    randomId?: () => string;
  } = {},
): PrivateUploadIntent {
  const extension = portraitExtension(input.contentType);
  if (!extension) {
    throw new ExternalServiceError(
      "R2",
      "A photograph must be a PNG, JPEG, or WebP image.",
    );
  }
  if (input.size <= 0 || input.size > PORTRAIT_RULES.maximumBytes) {
    throw new ExternalServiceError(
      "R2",
      `A photograph must be under ${Math.round(
        PORTRAIT_RULES.maximumBytes / (1024 * 1024),
      )} MB.`,
    );
  }

  const env = options.env ?? process.env;
  const config = r2Config(env, "R2_BUCKET_PUBLIC");
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const id = (options.randomId ?? randomUUID)();
  const key = `${portraitPrefix(input.memberId)}${id}.${extension}`;
  const receipt: UploadReceipt = {
    version: 1,
    key,
    kind: "portrait",
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

/** Where one member's portraits live. Nothing else may be written under it. */
export function portraitPrefix(memberId: string): string {
  return `members/${memberId}/`;
}

/**
 * Confirms a portrait arrived, is the size that was validated, and begins
 * with that format's signature. The declared media type is the browser's
 * claim; these bytes are what a visitor's browser will be handed.
 */
export async function assertPortraitExists(
  input: {
    key: string;
    memberId: string;
    contentType: string;
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
  const fetcher = dependencies.fetcher ?? fetch;

  if (!(PORTRAIT_RULES.types as readonly string[]).includes(input.contentType)) {
    throw new ExternalServiceError(
      "R2",
      "A photograph must be a PNG, JPEG, or WebP image.",
    );
  }
  // The receipt proves we minted this key; the prefix proves we minted it for
  // this person. Both, because a member may hold a valid receipt of their own.
  if (!input.key.startsWith(portraitPrefix(input.memberId))) {
    throw new ExternalServiceError("R2", "That photograph is not yours.");
  }

  const receipt = verifyUploadReceipt(
    input.uploadToken,
    { key: input.key, kind: "portrait" },
    { env, now },
  );
  if (receipt.size <= 0 || receipt.size > PORTRAIT_RULES.maximumBytes) {
    throw new ExternalServiceError(
      "R2",
      "That photograph exceeds its size limit.",
    );
  }

  const config = r2Config(env, "R2_BUCKET_PUBLIC");
  let head: Response;
  try {
    head = await fetcher(presignedR2Url("HEAD", input.key, config, now, 60), {
      method: "HEAD",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw new ExternalServiceError(
      "R2",
      `The upload could not be confirmed: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }
  if (!head.ok) {
    throw new ExternalServiceError(
      "R2",
      `The upload could not be confirmed (HTTP ${head.status}).`,
    );
  }

  const storedLength = Number(head.headers.get("content-length"));
  if (!Number.isSafeInteger(storedLength) || storedLength !== receipt.size) {
    throw new ExternalServiceError(
      "R2",
      "The uploaded photograph does not match the validated upload.",
    );
  }

  const signatures = MAGIC[input.contentType];
  if (!signatures) return;

  let prefixResponse: Response;
  try {
    prefixResponse = await fetcher(
      presignedR2Url("GET", input.key, config, now, 60),
      {
        method: "GET",
        headers: { Range: "bytes=0-15" },
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch (error) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded photograph could not be checked: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }
  if (!prefixResponse.ok) {
    throw new ExternalServiceError(
      "R2",
      `The uploaded photograph could not be read back (HTTP ${prefixResponse.status}).`,
    );
  }

  const bytes = new Uint8Array(await prefixResponse.arrayBuffer());
  if (!signatures.some((signature) => startsWith(bytes, signature))) {
    throw new ExternalServiceError(
      "R2",
      "That file is not the image type it claims to be.",
    );
  }
}
