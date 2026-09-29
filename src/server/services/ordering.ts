import { comparePositions, positionBetween } from "@/lib/position";
import { AppError } from "../errors";

/**
 * Where a dragged item was dropped, as the client sees it. Shared by every reorder
 * service (projects, lists, statuses, tasks):
 * - `afterId`: the item that is now directly BELOW the moved one;
 * - `beforeId`: the item that is now directly ABOVE it.
 * Send either (the other side is looked up) or both. Neither = move to the end.
 * When both are sent, `afterId` wins, so a stale `beforeId` can't break the order.
 */
export type MoveTarget = { beforeId?: string | null; afterId?: string | null };

/**
 * New position for `movedId` among `siblings` (all rows in the same ordering scope,
 * including the moved one). Throws VALIDATION for neighbours outside the scope.
 */
export function positionForMove(
  siblings: readonly { id: string; position: string }[],
  movedId: string,
  target: MoveTarget,
): string {
  const others = siblings.filter((s) => s.id !== movedId).sort((a, b) => comparePositions(a.position, b.position));
  const indexOf = (id: string) => {
    const i = others.findIndex((s) => s.id === id);
    if (i === -1) throw new AppError("VALIDATION", "Can't move next to an item from somewhere else");
    return i;
  };

  let above: string | null;
  let below: string | null;
  if (target.afterId) {
    const i = indexOf(target.afterId);
    above = others[i - 1]?.position ?? null;
    below = others[i].position;
  } else if (target.beforeId) {
    const i = indexOf(target.beforeId);
    above = others[i].position;
    below = others[i + 1]?.position ?? null;
  } else {
    above = others.at(-1)?.position ?? null;
    below = null;
  }
  // Two siblings can share a key if they were inserted concurrently; there's no key
  // strictly between them, so ask the client to retry rather than failing with a 500.
  if (above !== null && below !== null && above >= below) {
    throw new AppError("CONFLICT", "The order changed while you were moving this. Try again.");
  }
  return positionBetween(above, below);
}
