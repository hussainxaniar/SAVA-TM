"use client";

import { useSyncExternalStore } from "react";

// One MediaQueryList per query string, shared by every caller; `change` events fan out to
// per-query listener sets. Snapshots read `matches` live, so a resize just re-renders.

const listeners = new Map<string, Set<() => void>>();
const lists = new Map<string, MediaQueryList>();

function onMediaChange(e: MediaQueryListEvent) {
  listeners.get(e.media)?.forEach((cb) => cb());
}

function subscribe(query: string, cb: () => void) {
  let set = listeners.get(query);
  if (!set) {
    set = new Set();
    listeners.set(query, set);
  }
  set.add(cb);
  let mql = lists.get(query);
  if (!mql) {
    mql = window.matchMedia(query);
    mql.addEventListener("change", onMediaChange);
    lists.set(query, mql);
  }
  return () => {
    const live = listeners.get(query);
    live?.delete(cb);
    if (live && live.size === 0) {
      listeners.delete(query);
      lists.delete(query);
      mql?.removeEventListener("change", onMediaChange);
    }
  };
}

/**
 * A CSS media query as React state. SSR-safe: during the server render and hydration the
 * value is `serverDefault` — pass `true` for desktop-width queries so the server paints the
 * desktop layout and a phone re-renders right after hydration, no mismatch warning.
 */
export function useMediaQuery(query: string, serverDefault: boolean): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(query, cb),
    () => (lists.get(query) ?? window.matchMedia(query)).matches,
    () => serverDefault,
  );
}

/** Below 768px the app switches to its mobile layout (9.1); the server assumes desktop. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767.98px)", false);
}
