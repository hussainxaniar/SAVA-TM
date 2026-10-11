import { describe, expect, it } from "vitest";
import { swipeDirection } from "@/lib/swipe";

const p = (x: number, y: number, t: number) => ({ x, y, t });

describe("swipeDirection", () => {
  it("reads a quick sideways move", () => {
    expect(swipeDirection(p(300, 400, 0), p(200, 410, 200))).toBe("left");
    expect(swipeDirection(p(100, 400, 0), p(220, 380, 250))).toBe("right");
  });
  it("ignores short, slow or mostly vertical moves", () => {
    expect(swipeDirection(p(300, 400, 0), p(260, 400, 100))).toBeNull();
    expect(swipeDirection(p(300, 400, 0), p(150, 400, 900))).toBeNull();
    expect(swipeDirection(p(300, 400, 0), p(230, 300, 200))).toBeNull();
  });
});
