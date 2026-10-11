"use client";

import { useSyncExternalStore } from "react";

/*
 * How many pixels the on-screen keyboard covers at the bottom of the page. iOS Safari does not
 * shrink the layout viewport when the keyboard opens, so anything `fixed` to the bottom ends up
 * under it; the visual viewport tells us how much is hidden. Bottom sheets, the quick add sheet
 * and the editor's slash bar add this to their `bottom`. 0 on the server, on desktop and while
 * no keyboard is up.
 */

function subscribe(cb: () => void) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", cb);
  vv.addEventListener("scroll", cb);
  return () => {
    vv.removeEventListener("resize", cb);
    vv.removeEventListener("scroll", cb);
  };
}

/** Exported for tests: the covered height for a window and its visual viewport. */
export function keyboardInset(innerHeight: number, viewport: { height: number; offsetTop: number } | null): number {
  if (!viewport) return 0;
  const covered = Math.round(innerHeight - viewport.height - viewport.offsetTop);
  // Browser chrome showing and hiding moves this by a few pixels; a keyboard is far taller.
  return covered > 80 ? covered : 0;
}

export function useKeyboardInset(): number {
  return useSyncExternalStore(
    subscribe,
    () => keyboardInset(window.innerHeight, window.visualViewport ?? null),
    () => 0,
  );
}
