// Section 11.5. The options of the "/" menu in the rich-text editors, as plain data plus a filter, so the
// extension, the menu component and the tests share one source. `run` receives what it needs from the
// editor; the extension has already removed the typed "/text" (deleteRange) before calling it.

import type { Editor } from "@tiptap/react";

export type SlashGroup = "Basic blocks" | "Media" | "Tasks";

/** The icon the menu draws for an item (the menu component maps each key to a Tabler icon). */
export type SlashIconKey = "text" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "todo" | "quote" | "code" | "divider" | "image" | "task";

export type SlashContext = {
  editor: Editor;
  /** Opens the file picker and inserts the chosen images (needs a space for the upload). */
  pickImage: () => void;
  /** Opens the "Link task" search (docs only). */
  linkTask: () => void;
};

export type SlashItem = {
  id: string;
  title: string;
  group: SlashGroup;
  icon: SlashIconKey;
  /** Extra words the filter matches ("ul" finds Bullet list). */
  keywords: string[];
  /** Markdown shortcut shown on the right ("#", "-", "[]"); optional. */
  hint?: string;
  run: (ctx: SlashContext) => void;
};

const block = (id: string, title: string, icon: SlashIconKey, keywords: string[], run: (e: Editor) => void, hint?: string): SlashItem => ({
  id,
  title,
  group: "Basic blocks",
  icon,
  keywords,
  hint,
  run: ({ editor }) => run(editor),
});

export const SLASH_ITEMS: SlashItem[] = [
  block("text", "Text", "text", ["paragraph", "plain", "p"], (e) => e.chain().focus().setParagraph().run()),
  block("h1", "Heading 1", "h1", ["title", "h1", "big"], (e) => e.chain().focus().setNode("heading", { level: 1 }).run(), "#"),
  block("h2", "Heading 2", "h2", ["subtitle", "h2", "medium"], (e) => e.chain().focus().setNode("heading", { level: 2 }).run(), "##"),
  block("h3", "Heading 3", "h3", ["h3", "small"], (e) => e.chain().focus().setNode("heading", { level: 3 }).run(), "###"),
  block("bullet", "Bullet list", "bullet", ["ul", "unordered", "bulleted", "list", "points"], (e) => e.chain().focus().toggleBulletList().run(), "-"),
  block("numbered", "Numbered list", "numbered", ["ol", "ordered", "number", "list", "steps"], (e) => e.chain().focus().toggleOrderedList().run(), "1."),
  block("todo", "To-do list", "todo", ["todo", "to-do", "checkbox", "checklist", "task", "check"], (e) => e.chain().focus().toggleTaskList().run(), "[]"),
  block("quote", "Quote", "quote", ["blockquote", "citation"], (e) => e.chain().focus().toggleBlockquote().run(), ">"),
  block("code", "Code block", "code", ["snippet", "pre", "monospace"], (e) => e.chain().focus().toggleCodeBlock().run(), "```"),
  block("divider", "Divider", "divider", ["rule", "line", "separator", "hr"], (e) => e.chain().focus().setHorizontalRule().run(), "---"),
  { id: "image", title: "Image", group: "Media", icon: "image", keywords: ["picture", "photo", "upload", "screenshot"], run: ({ pickImage }) => pickImage() },
  { id: "task", title: "Link task", group: "Tasks", icon: "task", keywords: ["task", "link", "mention", "reference"], run: ({ linkTask }) => linkTask() },
];

const norm = (s: string) => s.toLowerCase().trim();

/**
 * The items for what was typed after "/": every item whose title or keywords start a word with the query
 * (so "head" and "h2" find Heading 2, "list" finds both lists), best matches first (title starts with the
 * query, then title contains it, then keywords); an empty query gives all items in their group order.
 * `available` removes items the current editor cannot do (no upload space, no task-link node).
 */
export function filterSlashItems(query: string, available: (item: SlashItem) => boolean = () => true): SlashItem[] {
  const q = norm(query);
  const items = SLASH_ITEMS.filter(available);
  if (!q) return items;
  const startsWord = (text: string) => norm(text).split(/[\s-]+/).some((w) => w.startsWith(q));
  const scored = items
    .map((item, index) => {
      const title = norm(item.title);
      const score = title.startsWith(q) ? 0 : startsWord(item.title) ? 1 : title.includes(q) ? 2 : item.keywords.some((k) => norm(k).startsWith(q)) ? 3 : -1;
      return { item, index, score };
    })
    .filter((x) => x.score >= 0);
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((x) => x.item);
}

/** The groups of a result list, in first-seen order, each with its items (the menu draws a header per group). */
export function groupSlashItems(items: readonly SlashItem[]): { group: SlashGroup; items: SlashItem[] }[] {
  const groups: { group: SlashGroup; items: SlashItem[] }[] = [];
  for (const item of items) {
    const g = groups.find((x) => x.group === item.group);
    if (g) g.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}
