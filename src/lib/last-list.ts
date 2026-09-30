/**
 * The last list the user opened or quick-added into, per space (localStorage; T-10). Quick add
 * uses it as the target when the current page has no list (My Tasks, Calendar, settings).
 * Storage can be unavailable (private mode, blocked site data): reads then return null.
 */
const key = (spaceId: string) => `sava.space.${spaceId}.lastList`;

export function readLastList(spaceId: string): string | null {
  try {
    return window.localStorage.getItem(key(spaceId));
  } catch {
    return null;
  }
}

export function rememberLastList(spaceId: string, listId: string): void {
  try {
    window.localStorage.setItem(key(spaceId), listId);
  } catch {
    // Not remembering is fine.
  }
}
