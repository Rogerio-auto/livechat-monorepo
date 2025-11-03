// backend/src/lib/crypto.ts
import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { ENCRYPTION_KEY } from "../config/env.ts";

const AES_ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const TAG_LENGTH = 16; // 128 bits

// -------- compatibilidade da chave --------
function parseKey(v?: string) {
  if (!v) throw new Error("ENCRYPTION_KEY is not set");

  // 1) tenta base64 -> 32 bytes
  try {
    const b = Buffer.from(v, "base64");
    if (b.length === 32) return b;
  } catch {}

  // 2) tenta hex (64 chars) -> 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(v)) {
    const b = Buffer.from(v, "hex");
    if (b.length === 32) return b;
  }

  // 3) tenta raw/utf8 de 32 bytes
  const utf = Buffer.from(v, "utf8");
  if (utf.length === 32) return utf;

  // 4) fallback legado: deriva 32 bytes com SHA-256 da string
  // (evita quebrar registros criptografados com lógica antiga)
  const sha = createHash("sha256").update(v, "utf8").digest();
  if (sha.length === 32) return sha;

  throw new Error("ENCRYPTION_KEY invalid: expected base64(32B), hex(64), raw(32B), or will derive with sha256");
}

const keyBytes = parseKey(ENCRYPTION_KEY);

// -------- helpers de empacotamento --------
function packSecret(iv: Buffer, tag: Buffer, ciphertext: Buffer): string {
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

function unpackSecret(packed: string): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const [ivB64, tagB64, ctB64] = packed.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Encrypted secret format is invalid");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error("Encrypted secret IV length is invalid");
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error("Encrypted secret tag length is invalid");
  }
  if (ciphertext.length === 0) {
    throw new Error("Encrypted secret ciphertext is empty");
  }
  return { iv, tag, ciphertext };
}

// -------- API pública --------
export function encryptSecret(plain: string): string {
  if (typeof plain !== "string" || !plain) {
    throw new Error("Plain secret must be a non-empty string");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGO, keyBytes, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return packSecret(iv, tag, ciphertext);
}

export function isEncryptedSecret(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const segments = value.split(".");
  if (segments.length !== 3) return false;
  // checagem leve de base64 (não perfeita, mas evita falsos óbvios)
  return segments.every((seg) => !!seg && /^[A-Za-z0-9+/=_-]+$/.test(seg));
}

export function decryptSecret(packed: string): string;
export function decryptSecret(packed: string | null | undefined): string | null;
export function decryptSecret(packed: string | null | undefined): string | null {
  if (packed === null || packed === undefined || packed === "") {
    return null;
  }
  if (!isEncryptedSecret(packed)) {
    return packed;
  }
  try {
    const { iv, tag, ciphertext } = unpackSecret(packed);
    const decipher = createDecipheriv(AES_ALGO, keyBytes, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return packed;
  }
}

// -------- URL encryption (for media URLs) --------
/**
 * Encrypts a URL and returns a token that can be used in a proxy endpoint
 * Format: encryptedData (base64url safe)
 */
export function encryptUrl(url: string): string {
  if (!url) return "";
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGO, keyBytes, iv);
  const ciphertext = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Pack as base64url (safe for URLs)
  const packed = packSecret(iv, tag, ciphertext);
  return Buffer.from(packed).toString("base64url");
}

/**
 * Decrypts a URL token back to the original URL
 */
export function decryptUrl(token: string): string | null {
  if (!token) return null;
  
  try {
    const packed = Buffer.from(token, "base64url").toString("utf8");
    const { iv, tag, ciphertext } = unpackSecret(packed);
    const decipher = createDecipheriv(AES_ALGO, keyBytes, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch (err) {
    console.error("[crypto] Failed to decrypt URL token:", err);
    return null;
  }
}

/**
 * Encrypts a media URL for storage, null-safe
 */
export function encryptMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return encryptUrl(url);
  } catch (err) {
    console.error("[crypto] Failed to encrypt media URL:", err);
    return url; // Fallback to original if encryption fails
  }
}

/**
 * Decrypts a media URL from storage, null-safe
 * If already decrypted (not encrypted format), returns as-is
 */
export function decryptMediaUrl(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  
  // Check if it looks like a URL (not encrypted)
  if (encrypted.startsWith("http://") || encrypted.startsWith("https://")) {
    return encrypted;
  }
  
  try {
    return decryptUrl(encrypted);
  } catch (err) {
    console.error("[crypto] Failed to decrypt media URL:", err);
    return encrypted; // Fallback to original
  }
}
