import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/**
 * Ordering keys for every orderable row (`position String`). Keys are base-62
 * strings compared by raw code unit ("0" < "A" < "a"), so:
 * - in SQL, position columns use `COLLATE "C"` (see the init migration);
 * - in JS, sort with `comparePositions`, never `localeCompare`.
 */

type Key = string | null | undefined;

/**
 * A key strictly between `before` and `after`. Either side may be absent.
 * Throws when `before >= after`: the library would silently swap them, which
 * hides a caller passing the wrong neighbours.
 */
export function positionBetween(before: Key, after: Key): string {
  assertOrdered(before, after);
  return generateKeyBetween(before ?? null, after ?? null);
}

/** A key before `first` (insert at start). `first` absent → first key ever. */
export function positionBefore(first: Key): string {
  return positionBetween(null, first);
}

/** A key after `last` (insert at end). `last` absent → first key ever. */
export function positionAfter(last: Key): string {
  return positionBetween(last, null);
}

/** `n` ascending keys strictly between `before` and `after`. */
export function positionsBetween(before: Key, after: Key, n: number): string[] {
  assertOrdered(before, after);
  return generateNKeysBetween(before ?? null, after ?? null, n);
}

export function comparePositions(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function assertOrdered(before: Key, after: Key) {
  if (before != null && after != null && before >= after) {
    throw new Error(`position: "${before}" must sort before "${after}"`);
  }
}
