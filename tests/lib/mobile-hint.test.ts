import { describe, expect, it } from "vitest";
import { isPhoneRequest } from "@/lib/mobile-hint";

const h = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("isPhoneRequest", () => {
  it("trusts the client hint when present", () => {
    expect(isPhoneRequest(h({ "sec-ch-ua-mobile": "?1", "user-agent": "Macintosh" }))).toBe(true);
    expect(isPhoneRequest(h({ "sec-ch-ua-mobile": "?0", "user-agent": "iPhone" }))).toBe(false);
  });
  it("falls back to the user agent", () => {
    expect(isPhoneRequest(h({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }))).toBe(true);
    expect(isPhoneRequest(h({ "user-agent": "Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari" }))).toBe(true);
    expect(isPhoneRequest(h({ "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }))).toBe(false);
  });
  it("treats tablets and missing headers as desktop", () => {
    expect(isPhoneRequest(h({ "user-agent": "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile" }))).toBe(false);
    expect(isPhoneRequest(h({ "user-agent": "Mozilla/5.0 (Linux; Android 15; SM-X910) Safari" }))).toBe(false);
    expect(isPhoneRequest(h({}))).toBe(false);
  });
});
