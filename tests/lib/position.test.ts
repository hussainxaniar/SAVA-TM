import { describe, it, expect } from "vitest";
import {
  comparePositions,
  positionAfter,
  positionBefore,
  positionBetween,
  positionsBetween,
} from "@/lib/position";

const sorted = (keys: string[]) => [...keys].sort(comparePositions);

describe("position", () => {
  it("creates a first key when the list is empty", () => {
    const k = positionBetween(null, null);
    expect(typeof k).toBe("string");
    expect(positionAfter(undefined)).toBe(k);
    expect(positionBefore(null)).toBe(k);
  });

  it("inserts at the start", () => {
    const first = positionAfter(null);
    const start = positionBefore(first);
    expect(comparePositions(start, first)).toBe(-1);
  });

  it("inserts at the end", () => {
    const first = positionAfter(null);
    const end = positionAfter(first);
    expect(comparePositions(end, first)).toBe(1);
  });

  it("inserts between two keys", () => {
    const a = positionAfter(null);
    const c = positionAfter(a);
    const b = positionBetween(a, c);
    expect(sorted([c, b, a])).toEqual([a, b, c]);
  });

  it("keeps order under repeated inserts at the same spot", () => {
    const a = positionAfter(null);
    let b = positionAfter(a);
    const inserted = [a];
    for (let i = 0; i < 50; i++) {
      b = positionBetween(a, b);
      inserted.push(b);
    }
    // each new key lands just after `a`, so ascending order is a, then newest → oldest
    expect(sorted(inserted)).toEqual([a, ...inserted.slice(1).reverse()]);
  });

  it("keeps order under 500 appends and 500 prepends", () => {
    const keys: string[] = [positionAfter(null)];
    for (let i = 0; i < 500; i++) keys.push(positionAfter(keys[keys.length - 1]));
    for (let i = 0; i < 500; i++) keys.unshift(positionBefore(keys[0]));
    expect(sorted(keys)).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("generates n ascending keys between bounds", () => {
    const a = positionAfter(null);
    const z = positionAfter(a);
    const keys = positionsBetween(a, z, 5);
    expect(keys).toHaveLength(5);
    expect(sorted([z, ...keys, a])).toEqual([a, ...keys, z]);
  });

  it("orders by code unit, not locale (upper before lower case)", () => {
    expect(comparePositions("aZ", "aa")).toBe(-1);
    expect(comparePositions("a0", "aA")).toBe(-1);
  });

  it("rejects bounds in the wrong order", () => {
    const a = positionAfter(null);
    const b = positionAfter(a);
    expect(() => positionBetween(b, a)).toThrow();
    expect(() => positionBetween(a, a)).toThrow();
    expect(() => positionsBetween(b, a, 2)).toThrow();
  });
});
