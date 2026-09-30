"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-browser UI preferences (sort, collapsed groups/tasks). Reads happen after hydration
// (server snapshot = fallback), so there are no hydration mismatches; failures fall back silently.

const listeners = new Map<string, Set<() => void>>();

function subscribe(key: string, cb: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(cb);
  listeners.set(key, set);
  const onStorage = (e: StorageEvent) => e.key === key && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** JSON value in localStorage under `key`, with `fallback` on the server and when unset/invalid. */
export function useLocalStorage<T>(key: string, fallback: T): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => read(key),
    () => null,
  );
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  const set = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage blocked or full: keep working for this view only
      }
      listeners.get(key)?.forEach((cb) => cb());
    },
    [key],
  );
  return [value, set];
}
