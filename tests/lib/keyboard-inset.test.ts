import { describe, expect, it } from "vitest";
import { keyboardInset } from "@/hooks/use-keyboard-inset";

describe("keyboardInset", () => {
  it("is 0 without a visual viewport or without a keyboard", () => {
    expect(keyboardInset(844, null)).toBe(0);
    expect(keyboardInset(844, { height: 844, offsetTop: 0 })).toBe(0);
  });
  it("ignores the browser chrome moving a few pixels", () => {
    expect(keyboardInset(844, { height: 790, offsetTop: 0 })).toBe(0);
  });
  it("is the covered height while the keyboard is up, also when the page is pushed up", () => {
    expect(keyboardInset(844, { height: 508, offsetTop: 0 })).toBe(336);
    expect(keyboardInset(844, { height: 508, offsetTop: 120 })).toBe(216);
  });
});
