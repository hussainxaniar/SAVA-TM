import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps same-origin paths with query strings", () => {
    expect(safeNext("/s/abc/my-tasks")).toBe("/s/abc/my-tasks");
    expect(safeNext("/s/abc/p/1/l/2?task=9")).toBe("/s/abc/p/1/l/2?task=9");
  });

  it("falls back to / for missing or external targets", () => {
    for (const bad of [undefined, null, "", "https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
