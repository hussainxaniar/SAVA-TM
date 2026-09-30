"use client";

import { useSyncExternalStore } from "react";

/**
 * The order of the task rows currently on screen (T-11): the list view publishes it, the task
 * dialog's ↑/↓ steps through it. Later views (My Tasks) publish theirs the same way. Views clear
 * it on unmount so the dialog never steps through a list that's gone.
 */
const EMPTY: readonly string[] = [];
let order: readonly string[] = EMPTY;
const listeners = new Set<() => void>();

export function publishTaskOrder(ids: readonly string[]): void {
  if (ids.length === order.length && ids.every((id, i) => id === order[i])) return;
  order = ids.length ? ids : EMPTY;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTaskOrder(): readonly string[] {
  return useSyncExternalStore(subscribe, () => order, () => EMPTY);
}
