import { describe, expect, it } from "vitest";
import { appOrigin } from "@/lib/app-origin";

describe("appOrigin", () => {
  it("uses APP_URL's origin, even when the request came in on the internal address", () => {
    expect(appOrigin("http://localhost:3000", "https://tm.sava.af")).toBe("https://tm.sava.af");
    expect(appOrigin("http://localhost:3000", "https://tm.sava.af/")).toBe("https://tm.sava.af");
    expect(appOrigin("http://localhost:3000", "https://tm.sava.af/some/path?x=1")).toBe("https://tm.sava.af");
  });

  it("falls back to the request's origin when APP_URL is missing or not a URL", () => {
    expect(appOrigin("http://localhost:3000", undefined)).toBe("http://localhost:3000");
    expect(appOrigin("http://localhost:3000", "")).toBe("http://localhost:3000");
    expect(appOrigin("https://preview.example", "not a url")).toBe("https://preview.example");
  });
});
