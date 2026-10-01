import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt, signState, verifyState } from "@/server/crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.AUTH_SECRET ??= "test-secret";
});

describe("encrypt / decrypt", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("ya29.token");
    const b = encrypt("ya29.token");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("ya29.token");
  });

  it("rejects tampered data and wrong keys", () => {
    const stored = encrypt("secret");
    const buf = Buffer.from(stored, "base64");
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(() => decrypt(stored)).toThrow();
    process.env.ENCRYPTION_KEY = "too-short";
    expect(() => encrypt("x")).toThrow(/32 bytes/);
    process.env.ENCRYPTION_KEY = saved;
  });
});

describe("signState / verifyState", () => {
  it("accepts its own state for the same user within 10 minutes", () => {
    const now = Date.now();
    const token = signState({ userId: "u1", spaceId: "s1" }, now);
    expect(verifyState(token, "u1", now + 9 * 60_000)).toEqual({ userId: "u1", spaceId: "s1" });
  });

  it("rejects expiry, another user, and any tampering", () => {
    const now = Date.now();
    const token = signState({ userId: "u1", spaceId: "s1" }, now);
    expect(() => verifyState(token, "u1", now + 11 * 60_000)).toThrow(/expired/);
    expect(() => verifyState(token, "u2", now)).toThrow();
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "u2", s: "s1", n: "x", e: now + 60_000 })).toString("base64url");
    expect(() => verifyState(`${forged}.${sig}`, "u2", now)).toThrow();
    expect(() => verifyState(`${payload}.`, "u1", now)).toThrow();
    expect(() => verifyState("garbage", "u1", now)).toThrow();
  });
});
