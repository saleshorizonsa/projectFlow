import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY env var must be a 64-character hex string (32 bytes / 256 bits)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = [iv, tag, encrypted].map((b) => b.toString("base64")).join(":");
  return PREFIX + payload;
}

export function decryptField(value: string): string {
  // Backwards-compatible: if not in encrypted format, return as-is (plaintext legacy value)
  if (!value.startsWith(PREFIX)) return value;
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return value;
  const [iv, tag, encrypted] = parts.map((p) => Buffer.from(p, "base64"));
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// Safe version: returns null if key is missing or decryption fails (e.g. key not set in env)
export function safeDecryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptField(value);
  } catch {
    return null;
  }
}
