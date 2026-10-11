// Section 4 (Client). The app has no live data sync (WebSocket/SSE), so the views people watch while others (or an
// AI through MCP) change tasks refetch on a timer: list view, My Tasks, the open task and its
// feed, and the calendar. TanStack Query pauses the timer while the tab is hidden. Doc pages are
// not polled: the editor is the source of truth while it is open.
export const LIVE_REFETCH_MS = 15_000;
