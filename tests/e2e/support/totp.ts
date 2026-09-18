import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/gu, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Not base32: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * RFC 6238 code for a base32 secret, as authenticator apps compute it.
 * `offset` picks a neighbouring 30-second window (-1, 0, 1).
 */
export function totp(secret: string, offset = 0, now = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30) + offset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(message)
    .digest();
  const start = digest[digest.length - 1]! & 0x0f;
  const binary = digest.readUInt32BE(start) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}
