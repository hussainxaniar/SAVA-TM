"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/*
 * Dragging a task row onto a list in the sidebar (6.5 / 6.6, T-13). The list view and the
 * sidebar live in different DndContexts, so the drop target isn't a dnd-kit droppable: while a
 * row drag is active we follow the pointer, find the sidebar list under it (any element inside
 * `[data-drop-list-id]`) and whether Alt is held (Alt = add to the list, otherwise move).
 * The sidebar reads the hovered target from a tiny store to highlight it.
 */

export type SidebarDropTarget = { listId: string; mode: "move" | "add" } | null;

let current: SidebarDropTarget = null;
const listeners = new Set<() => void>();

function publish(next: SidebarDropTarget) {
  if (current?.listId === next?.listId && current?.mode === next?.mode) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For the sidebar: the list a row is being dragged over right now (only valid targets), or null. */
export function useSidebarDropTarget(): SidebarDropTarget {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/**
 * For the list view. Call `begin(isValid)` in onDragStart; `end()` in onDragEnd/onDragCancel
 * returns where it was dropped (a valid sidebar list or null) and whether Alt was held.
 * `isValid(listId, mode)` decides which lists light up (e.g. same project, not this list).
 */
export function useSidebarDrop() {
  const state = useRef<{ x: number; y: number; alt: boolean; cleanup: (() => void) | null; isValid: (listId: string, mode: "move" | "add") => boolean }>({
    x: 0,
    y: 0,
    alt: false,
    cleanup: null,
    isValid: () => false,
  });

  const update = useCallback(() => {
    const s = state.current;
    const mode = s.alt ? "add" : "move";
    const listId = listUnder(s.x, s.y);
    publish(listId && s.isValid(listId, mode) ? { listId, mode } : null);
  }, []);

  const begin = useCallback(
    (isValid: (listId: string, mode: "move" | "add") => boolean) => {
      const s = state.current;
      s.cleanup?.();
      s.isValid = isValid;
      const onMove = (e: PointerEvent) => {
        s.x = e.clientX;
        s.y = e.clientY;
        s.alt = e.altKey;
        update();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Alt") return;
        s.alt = e.type === "keydown";
        update();
      };
      window.addEventListener("pointermove", onMove, { capture: true, passive: true });
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("keyup", onKey, true);
      s.cleanup = () => {
        window.removeEventListener("pointermove", onMove, { capture: true });
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("keyup", onKey, true);
      };
    },
    [update],
  );

  const end = useCallback((): { listId: string; mode: "move" | "add" } | null => {
    const s = state.current;
    s.cleanup?.();
    s.cleanup = null;
    const target = current;
    publish(null);
    return target;
  }, []);

  return { begin, end };
}

function listUnder(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const hit = el.closest<HTMLElement>("[data-drop-list-id]");
    if (hit) return hit.dataset.dropListId ?? null;
  }
  return null;
}
