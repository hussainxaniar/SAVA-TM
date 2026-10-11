import { describe, expect, it } from "vitest";
import { inviteTokenFromPath } from "@/lib/invite-cookie";

describe("inviteTokenFromPath", () => {
  it("reads the token of an invite path", () => {
    expect(inviteTokenFromPath("/invite/abc_DEF-123")).toBe("abc_DEF-123");
    expect(inviteTokenFromPath("/invite/abc?x=1")).toBe("abc");
    expect(inviteTokenFromPath("/invite/abc/")).toBe("abc");
  });

  it("is null for other paths and odd tokens", () => {
    for (const path of ["/", "/s/abc", "/invite/", "/invite/a.b", "/xinvite/abc", `/invite/${"a".repeat(101)}`]) {
      expect(inviteTokenFromPath(path)).toBeNull();
    }
  });
});
