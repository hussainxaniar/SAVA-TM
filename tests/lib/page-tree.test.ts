import { describe, expect, it } from "vitest";
import { flattenTree, projectDrop, subtreeHeight, subtreeIds, type TreeRow } from "@/lib/page-tree";

// A ─ A1 ─ A1a
//   └ A2
// B
// C ─ C1
const n = (id: string, parentId: string | null, position: string): TreeRow => ({ id, parentId, position });
const nodes = [n("A", null, "a0"), n("A1", "A", "a0"), n("A1a", "A1", "a0"), n("A2", "A", "a1"), n("B", null, "a1"), n("C", null, "a2"), n("C1", "C", "a0")];
const visible = (collapsed: string[] = []) => flattenTree(nodes, new Set(collapsed));
const ids = (collapsed: string[] = []) => visible(collapsed).map((r) => `${"-".repeat(r.depth)}${r.node.id}`);
const drop = (active: string, over: string, dx = 0) => projectDrop(visible(), nodes, active, over, dx, 20);

describe("flattenTree / subtree helpers", () => {
  it("lists visible pages in order and hides collapsed subtrees", () => {
    expect(ids()).toEqual(["A", "-A1", "--A1a", "-A2", "B", "C", "-C1"]);
    expect(ids(["A"])).toEqual(["A", "B", "C", "-C1"]);
    expect(visible()[0]).toMatchObject({ depth: 0, hasChildren: true });
    expect(subtreeIds(nodes, "A")).toEqual(["A", "A1", "A2", "A1a"]);
    expect(subtreeHeight(nodes, "A")).toBe(2);
    expect(subtreeHeight(nodes, "B")).toBe(0);
  });
});

describe("projectDrop", () => {
  it("reorders among siblings without changing the parent", () => {
    expect(drop("B", "A")).toMatchObject({ parentId: null, beforeId: null, afterId: "A", depth: 0 });
    expect(drop("C", "B")).toMatchObject({ parentId: null, beforeId: "A", afterId: "B" });
    expect(drop("A2", "A1")).toMatchObject({ parentId: "A", beforeId: null, afterId: "A1" });
  });

  it("nests under the row above when dragged right, and promotes when dragged left", () => {
    // B dropped in place, dragged right: becomes the last child of A's subtree level? The row above B is A2 (depth 1).
    expect(drop("B", "B", 20)).toMatchObject({ parentId: "A", beforeId: "A2", afterId: null, depth: 1 });
    expect(drop("A2", "A2", -20)).toMatchObject({ parentId: null, beforeId: "A", afterId: "B", depth: 0 });
    // Nothing changes when the drop equals the current place.
    expect(drop("B", "B", 0)).toBeNull();
    expect(drop("A2", "A2", 0)).toBeNull();
  });

  it("respects the three-level limit and the rows around it", () => {
    // B is a leaf: dragged far right it nests as deep as the row above allows: under A2, at depth 2.
    expect(drop("B", "B", 100)).toMatchObject({ parentId: "A2", depth: 2 });
    // A (height 2) can't nest anywhere: under B it would reach depth 3.
    expect(drop("A", "B", 100)).toMatchObject({ depth: 0 });
    // C1 is already as deep as it can be under C: dragging right changes nothing.
    expect(drop("C1", "C1", 400)).toBeNull();
  });

  it("refuses a drop onto the page's own subtree", () => {
    expect(drop("A", "A1")).toBeNull();
    expect(drop("A", "A1a")).toBeNull();
  });
});
