import { AsyncLocalStorage } from "node:async_hooks";

// Section 15.1. Anything written while a request runs inside `runVia` is labelled as written
// through an API token: logActivity adds `via` to the payload and addComment stores
// `Comment.via`. A request-scoped store means no service call site has to change.

export type Via = "mcp";

const store = new AsyncLocalStorage<{ via: Via }>();

export function runVia<T>(via: Via, fn: () => T): T {
  return store.run({ via }, fn);
}

/** The label for writes in the current request, or null for a person using the web app. */
export function currentVia(): Via | null {
  return store.getStore()?.via ?? null;
}
