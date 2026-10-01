import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { AppError } from "./errors";

/*
 * Section 10.2. Google tokens are stored encrypted with AES-256-GCM under ENCRYPTION_KEY (32 bytes,
 * base64). Stored form: base64(iv[12] | tag[16] | ciphertext). The OAuth `state` is signed with
 * AUTH_SECRET (HMAC-SHA256) and expires after 10 minutes.
 */

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

// ---------- OAuth state ----------

export type OAuthState = { userId: string; spaceId: string };

const STATE_TTL_MS = 10 * 60 * 1000;

function hmac(data: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(data).digest();
}

/** `<payload>.<signature>`, both base64url; the payload carries a nonce and the expiry. */
export function signState(state: OAuthState, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ u: state.userId, s: state.spaceId, n: randomBytes(12).toString("base64url"), e: now + STATE_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${hmac(payload).toString("base64url")}`;
}

/** The state's contents if the signature is valid, it hasn't expired, and it belongs to `userId`. */
export function verifyState(token: string, userId: string, now = Date.now()): OAuthState {
  const invalid = new AppError("VALIDATION", "That Google sign-in link is invalid or has expired. Try connecting again.");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw invalid;
  const expected = hmac(payload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid;
  let data: { u?: unknown; s?: unknown; e?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalid;
  }
  if (typeof data.e !== "number" || data.e < now) throw invalid;
  if (data.u !== userId || typeof data.s !== "string") throw invalid;
  return { userId, spaceId: data.s };
}
