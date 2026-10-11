/**
 * Was this touch a horizontal swipe? Used by the phone calendar to go to the next / previous
 * days: at least 56px sideways, clearly more sideways than vertical, and quick (a slow drag is
 * the user scrolling or moving a block).
 */
export function swipeDirection(
  start: { x: number; y: number; t: number },
  end: { x: number; y: number; t: number },
): "left" | "right" | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (end.t - start.t > 600) return null;
  if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.8) return null;
  return dx < 0 ? "left" : "right";
}
