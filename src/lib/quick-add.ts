/**
 * "Add task" requests from the sidebar button. The quick-add dialog (T-10) listens for it and
 * also handles the `q` shortcut itself.
 */
export const QUICK_ADD_EVENT = "sava:quick-add";

export function requestQuickAdd() {
  window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT));
}
