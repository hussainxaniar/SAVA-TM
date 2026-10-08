// Section 15.3. A fixed-window counter per token, in memory: the app runs as one instance
// today. Before running several instances this needs a shared store.

export const RATE_LIMIT = 120;
const WINDOW_MS = 60_000;

const windows = new Map<string, { start: number; count: number }>();

/** Counts one request for `key`. Returns false when the window's limit is already used up. */
export function allowRequest(key: string, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || now - w.start >= WINDOW_MS) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5_000) prune(now);
    return true;
  }
  if (w.count >= RATE_LIMIT) return false;
  w.count += 1;
  return true;
}

function prune(now: number) {
  for (const [key, w] of windows) if (now - w.start >= WINDOW_MS) windows.delete(key);
}

/** For tests. */
export function resetRateLimit() {
  windows.clear();
}
