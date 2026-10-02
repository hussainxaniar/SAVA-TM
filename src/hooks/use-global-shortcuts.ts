import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Sidebar visibility request (9.7). The sidebar state itself arrives with the `[` part of the
 * sidebar ticket; until then this event is simply broadcast and nobody consumes it.
 */
export const TOGGLE_SIDEBAR_EVENT = "sava:toggle-sidebar";
/** Opens the "Keyboard shortcuts" dialog owned by global-shortcuts.tsx (9.7). */
export const SHOW_SHORTCUTS_EVENT = "sava:show-shortcuts";

export function toggleSidebar() {
  window.dispatchEvent(new CustomEvent(TOGGLE_SIDEBAR_EVENT));
}

export function showShortcuts() {
  window.dispatchEvent(new CustomEvent(SHOW_SHORTCUTS_EVENT));
}

/**
 * True when `e` may act as a shortcut (9.7): no Ctrl/Meta/Alt, not an auto-repeat, not while
 * typing in a field, and no dialog open. Shared by the global hook and the view-scoped
 * selection handlers.
 */
export function shortcutEventAllowed(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.isComposing) return false;
  const t = e.target as HTMLElement | null;
  if (
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  )
    return false;
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return false;
  return true;
}

/** The task dialog stays mounted across views and reads `?task=`; selection keys stand down. */
export function isTaskDialogOpen(): boolean {
  return new URLSearchParams(window.location.search).has("task");
}

/** How long `g` stays armed while waiting for its destination key (9.7). */
const G_CHORD_MS = 1200;

/**
 * Section 9.7 global shortcuts, one `window` keydown listener: `[` toggles the sidebar,
 * `g`+`m`/`c` navigate, `/` is reserved for v2 search, `?` opens the shortcut help. `q` and
 * `Esc` belong to the quick-add dialog and Base UI dialogs themselves.
 */
export function useGlobalShortcuts({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const gAt = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!shortcutEventAllowed(e)) return;
      const now = Date.now();
      const chorded = now - gAt.current < G_CHORD_MS;
      gAt.current = 0;
      if (chorded) {
        if (e.key === "m") {
          e.preventDefault();
          router.push(`/s/${spaceId}/my-tasks`);
          return;
        }
        if (e.key === "c") {
          e.preventDefault();
          router.push(`/s/${spaceId}/calendar`);
          return;
        }
      }
      if (e.key === "g") {
        gAt.current = now;
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.key === "/") {
        // Reserved for v2 search (9.7): swallow the key so nothing else reacts to it.
        e.preventDefault();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        showShortcuts();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, spaceId]);
}
