import { comparePositions } from "./position";

/*
 * The doc page tree (Section 11.1): building it from flat rows, flattening what's visible, and the
 * drop maths for drag to reorder / re-nest. Pure, so the tree UI only wires pointer events.
 */

export const MAX_PAGE_DEPTH = 2; // 0, 1, 2 = three levels

export type TreeRow = { id: string; parentId: string | null; position: string };
export type FlatRow<T extends TreeRow> = { node: T; depth: number; hasChildren: boolean };

/** Visible rows in document order (parents before children, siblings by position). Collapsed pages hide their subtree. */
export function flattenTree<T extends TreeRow>(nodes: readonly T[], collapsed: ReadonlySet<string> = new Set()): FlatRow<T>[] {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n]);
  for (const list of byParent.values()) list.sort((a, b) => comparePositions(a.position, b.position));
  const out: FlatRow<T>[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      const kids = byParent.get(node.id) ?? [];
      out.push({ node, depth, hasChildren: kids.length > 0 });
      if (!collapsed.has(node.id)) walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** The page and everything below it. */
export function subtreeIds(nodes: readonly TreeRow[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const n of nodes) if (n.parentId === out[i]) out.push(n.id);
  return out;
}

/** Levels below `id` (0 for a leaf). */
export function subtreeHeight(nodes: readonly TreeRow[], id: string): number {
  let height = 0;
  let frontier = [id];
  for (;;) {
    frontier = nodes.filter((n) => n.parentId !== null && frontier.includes(n.parentId)).map((n) => n.id);
    if (frontier.length === 0) return height;
    height += 1;
  }
}

export type Drop = {
  parentId: string | null;
  /** The page now directly above / below it among its new siblings (movePage's MoveTarget). */
  beforeId: string | null;
  afterId: string | null;
  depth: number;
};

/**
 * Where a dragged page lands (the dnd-kit sortable-tree rule). The page takes `overId`'s place in
 * the visible list, and the horizontal drag distance picks the nesting: each `indent` px to the
 * right is one level deeper, to the left one shallower, clamped to what the rows around it allow
 * (it can only nest under the row above it, and can't be shallower than the row below) and to the
 * three-level limit for its whole subtree. `null` when nothing would change, or the drop is
 * illegal (onto its own subtree).
 */
export function projectDrop<T extends TreeRow>(
  visible: readonly FlatRow<T>[],
  all: readonly T[],
  activeId: string,
  overId: string,
  offsetX: number,
  indent: number,
): Drop | null {
  const own = new Set(subtreeIds(all, activeId));
  if (own.has(overId) && overId !== activeId) return null;
  const rows = visible.filter((r) => r.node.id === activeId || !own.has(r.node.id));
  const from = rows.findIndex((r) => r.node.id === activeId);
  const to = rows.findIndex((r) => r.node.id === overId);
  if (from < 0 || to < 0) return null;

  const moved = [...rows];
  const [active] = moved.splice(from, 1);
  moved.splice(to, 0, active);
  const above = moved[to - 1];
  const below = moved[to + 1];

  const maxDepth = above ? Math.min(above.depth + 1, MAX_PAGE_DEPTH - subtreeHeight(all, activeId)) : 0;
  const minDepth = below ? below.depth : 0;
  const wanted = active.depth + Math.round(offsetX / indent);
  const depth = Math.max(0, Math.min(Math.max(wanted, minDepth), maxDepth));

  // The parent is the nearest row above at one level up.
  let parentId: string | null = null;
  if (depth > 0) {
    for (let i = to - 1; i >= 0; i--) {
      if (moved[i].depth === depth - 1) {
        parentId = moved[i].node.id;
        break;
      }
    }
  }

  // Neighbours among the new siblings: the nearest same-parent rows, stopping where the parent's subtree ends.
  let beforeId: string | null = null;
  for (let i = to - 1; i >= 0 && moved[i].depth >= depth; i--) {
    if (moved[i].node.parentId === parentId && moved[i].depth === depth) {
      beforeId = moved[i].node.id;
      break;
    }
  }
  let afterId: string | null = null;
  for (let i = to + 1; i < moved.length && moved[i].depth >= depth; i++) {
    if (moved[i].node.parentId === parentId && moved[i].depth === depth) {
      afterId = moved[i].node.id;
      break;
    }
  }

  const current = all.find((n) => n.id === activeId);
  if (!current) return null;
  const sibs = all.filter((n) => n.parentId === current.parentId).sort((a, b) => comparePositions(a.position, b.position));
  const i = sibs.findIndex((n) => n.id === activeId);
  const unchanged = current.parentId === parentId && (sibs[i - 1]?.id ?? null) === beforeId && (sibs[i + 1]?.id ?? null) === afterId;
  return unchanged ? null : { parentId, beforeId, afterId, depth };
}
