// Section 11.4. A doc page links a task with an inline `taskLink` node: attrs { taskId, title }
// (`title` is only a snapshot for text exports and for when the task can't be read; the editor shows
// the live title). The same helper serves the server (the DocTaskLink index, MCP checks) and the client.

type Node = { type?: string; attrs?: Record<string, unknown>; content?: Node[] };

export const TASK_LINK_NODE = "taskLink";

/** Every task id linked by a Tiptap value, once each, in document order. */
export function taskLinkIds(doc: unknown): string[] {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Node;
    if (n.type === TASK_LINK_NODE && typeof n.attrs?.taskId === "string" && n.attrs.taskId) ids.push(n.attrs.taskId);
    for (const child of n.content ?? []) walk(child);
  };
  walk(doc);
  return [...new Set(ids)];
}

/** A copy of the value with every task link's `title` replaced from `titles` (id → title); unknown ids keep their snapshot. */
export function withTaskLinkTitles<T>(doc: T, titles: ReadonlyMap<string, string>): T {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    const n = node as Node;
    const content = n.content?.map(walk) as Node[] | undefined;
    const taskId = n.attrs?.taskId;
    const attrs =
      n.type === TASK_LINK_NODE && typeof taskId === "string" && titles.has(taskId) ? { ...n.attrs, title: titles.get(taskId) } : n.attrs;
    return { ...n, ...(attrs ? { attrs } : {}), ...(content ? { content } : {}) };
  };
  return walk(doc) as T;
}
