import { describe, expect, it } from "vitest";
import { comparePositions, positionAfter } from "@/lib/position";
import { positionForMove, type MoveTarget } from "@/server/services/ordering";

// a, b, c, d in order
const keys: string[] = [];
for (let i = 0; i < 4; i++) keys.push(positionAfter(keys.at(-1)));
const rows = ["a", "b", "c", "d"].map((id, i) => ({ id, position: keys[i] }));

/** Order of ids after moving `id` to `target`. */
function orderAfter(id: string, target: MoveTarget) {
  const position = positionForMove(rows, id, target);
  return rows
    .map((r) => (r.id === id ? { ...r, position } : r))
    .sort((x, y) => comparePositions(x.position, y.position))
    .map((r) => r.id);
}

describe("positionForMove", () => {
  it("moves above an item (afterId)", () => {
    expect(orderAfter("d", { afterId: "a" })).toEqual(["d", "a", "b", "c"]);
    expect(orderAfter("a", { afterId: "d" })).toEqual(["b", "c", "a", "d"]);
  });

  it("moves below an item (beforeId)", () => {
    expect(orderAfter("a", { beforeId: "d" })).toEqual(["b", "c", "d", "a"]);
    expect(orderAfter("d", { beforeId: "a" })).toEqual(["a", "d", "b", "c"]);
  });

  it("uses afterId when both are given, even if beforeId is stale", () => {
    expect(orderAfter("a", { beforeId: "b", afterId: "c" })).toEqual(["b", "a", "c", "d"]);
    expect(orderAfter("a", { beforeId: "d", afterId: "c" })).toEqual(["b", "a", "c", "d"]);
  });

  it("moves to the end when no neighbour is given", () => {
    expect(orderAfter("b", {})).toEqual(["a", "c", "d", "b"]);
  });

  it("handles a single item and a no-op drop", () => {
    expect(positionForMove([rows[0]], "a", {})).toBeTypeOf("string");
    expect(orderAfter("b", { afterId: "c" })).toEqual(["a", "b", "c", "d"]);
  });

  it("returns CONFLICT instead of crashing when neighbours share a key", () => {
    // e ties with b; the stable sort keeps b first, so dropping above e lands between equal keys.
    const tied = [...rows, { id: "e", position: rows[1].position }];
    expect(() => positionForMove(tied, "a", { afterId: "e" })).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("rejects neighbours outside the scope, or the item itself", () => {
    expect(() => positionForMove(rows, "a", { afterId: "zzz" })).toThrow();
    expect(() => positionForMove(rows, "a", { afterId: "a" })).toThrow();
  });
});
