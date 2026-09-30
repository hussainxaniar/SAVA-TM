/**
 * "Add task" requests (sidebar button now, the `q` shortcut in T-10). T-09's list view answers by
 * opening its inline add; T-10's quick-add dialog replaces that listener.
 */
export const QUICK_ADD_EVENT = "sava:quick-add";

export function requestQuickAdd() {
  window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT));
}
