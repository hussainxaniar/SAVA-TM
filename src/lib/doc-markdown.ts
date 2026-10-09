// Section 15.4 (documents). API clients read and write doc pages as Markdown; the app stores Tiptap
// JSON. This covers exactly what the docs editor has (11.1): headings 1-3, bold, italic, strike,
// inline code, links, bullet / numbered / task lists (nested), blockquotes, code blocks, rules and
// block images. The editor has no tables, so a pipe table is kept as a code block (nothing is lost).
// A single newline inside a paragraph is a line break, like plainToDoc does for tasks.
// A task link (11.4) is `[Task title](task:<taskId>)`; it becomes a taskLink node (attrs taskId, title) and back.

type Mark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = { type: string; attrs?: Record<string, unknown>; content?: DocNode[]; text?: string; marks?: Mark[] };
export type DocJson = { type: "doc"; content: DocNode[] };

// ---------- Markdown to doc ----------

export function markdownToDoc(markdown: string): DocJson {
  return { type: "doc", content: parseBlocks(markdown.replace(/\r\n?/g, "\n").split("\n")) };
}

const TASK_HREF = "task:";
const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const TASK = /^\[([ xX])\]\s+(.*)$/;
const IMAGE = /^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;

const isTable = (l: string) => l.trimStart().startsWith("|");
const startsBlock = (l: string) =>
  FENCE.test(l) || HEADING.test(l) || RULE.test(l) || QUOTE.test(l) || isTable(l) || BULLET.test(l) || ORDERED.test(l) || IMAGE.test(l);

function parseBlocks(lines: string[]): DocNode[] {
  const out: DocNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++; // the closing fence (or the end of the text)
      out.push(codeBlock(body.join("\n"), fence[2]));
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ type: "heading", attrs: { level: Math.min(heading[1].length, 3) }, content: inline(heading[2]) });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) inner.push(lines[i++].replace(/^\s{0,3}>\s?/, ""));
      const content = parseBlocks(inner);
      out.push({ type: "blockquote", content: content.length ? content : [{ type: "paragraph" }] });
      continue;
    }

    if (isTable(line)) {
      const rows: string[] = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++].trimEnd());
      out.push(codeBlock(rows.join("\n"), ""));
      continue;
    }

    const image = IMAGE.exec(line);
    if (image) {
      out.push({ type: "image", attrs: { src: image[2], alt: image[1] || null } });
      i++;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const [list, next] = parseList(lines, i);
      out.push(list);
      i = next;
      continue;
    }

    const para: DocNode[] = [];
    while (i < lines.length && lines[i].trim() !== "" && (para.length === 0 || !startsBlock(lines[i]))) {
      if (para.length) para.push({ type: "hardBreak" });
      para.push(...inline(lines[i].trim()));
      i++;
    }
    out.push(para.length ? { type: "paragraph", content: para } : { type: "paragraph" });
  }
  return out;
}

function codeBlock(text: string, language: string): DocNode {
  return {
    type: "codeBlock",
    attrs: { language: language || null },
    ...(text ? { content: [{ type: "text", text }] } : {}),
  };
}

type Marker = { indent: number; ordered: boolean; start: number; text: string };

function markerOf(line: string): Marker | null {
  const b = BULLET.exec(line);
  if (b) return { indent: b[1].length, ordered: false, start: 1, text: b[2] };
  const o = ORDERED.exec(line);
  if (o) return { indent: o[1].length, ordered: true, start: Number(o[2]), text: o[3] };
  return null;
}

/** One list starting at `lines[from]`; items at the same indent and kind continue it, deeper lines belong to the item above. */
function parseList(lines: string[], from: number): [DocNode, number] {
  const first = markerOf(lines[from])!;
  const items: { text: string; sub: string[] }[] = [];
  let i = from;
  while (i < lines.length) {
    const m = markerOf(lines[i]);
    if (!m || m.indent !== first.indent || m.ordered !== first.ordered) break;
    const item = { text: m.text, sub: [] as string[] };
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") {
        // A blank line keeps the list going only if more of it follows.
        let j = i;
        while (j < lines.length && lines[j].trim() === "") j++;
        const next = lines[j] === undefined ? null : markerOf(lines[j]);
        const indented = lines[j] !== undefined && /^\s/.test(lines[j]) && (lines[j].length - lines[j].trimStart().length) > first.indent;
        if (next && next.indent >= first.indent && (next.indent === first.indent ? next.ordered === first.ordered : true)) {
          item.sub.push(...lines.slice(i, j));
          i = j;
          continue;
        }
        if (indented) {
          item.sub.push(...lines.slice(i, j));
          i = j;
          continue;
        }
        break;
      }
      const indent = l.length - l.trimStart().length;
      if (indent <= first.indent) break;
      item.sub.push(l.replace(new RegExp(`^ {0,${first.indent + 2}}`), ""));
      i++;
    }
    items.push(item);
  }

  const isTask = !first.ordered && TASK.test(items[0].text);
  const content = items.map(({ text, sub }): DocNode => {
    const task = isTask ? TASK.exec(text) : null;
    const body = task ? task[2] : text;
    const children = [{ type: "paragraph", content: inline(body) } as DocNode, ...parseBlocks(sub)];
    return isTask
      ? { type: "taskItem", attrs: { checked: !!task && task[1].toLowerCase() === "x" }, content: children }
      : { type: "listItem", content: children };
  });
  if (isTask) return [{ type: "taskList", content }, i];
  if (first.ordered) return [{ type: "orderedList", attrs: { start: first.start }, content }, i];
  return [{ type: "bulletList", content }, i];
}

// Inline marks, earliest match first. Code is literal; the others nest.
const INLINE: { re: RegExp; mark: (m: RegExpExecArray) => Mark | null; group: number }[] = [
  { re: /`([^`\n]+)`/, mark: () => ({ type: "code" }), group: 1 },
  { re: /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/, mark: (m) => ({ type: "link", attrs: { href: m[2] } }), group: 1 },
  { re: /\*\*(?=\S)(.+?)(?<=\S)\*\*/, mark: () => ({ type: "bold" }), group: 1 },
  { re: /(?<![A-Za-z0-9_])__(?=\S)(.+?)(?<=\S)__(?![A-Za-z0-9_])/, mark: () => ({ type: "bold" }), group: 1 },
  { re: /~~(?=\S)(.+?)(?<=\S)~~/, mark: () => ({ type: "strike" }), group: 1 },
  { re: /\*(?=[^\s*])(.+?)(?<=[^\s*])\*/, mark: () => ({ type: "italic" }), group: 1 },
  { re: /(?<![A-Za-z0-9_])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![A-Za-z0-9_])/, mark: () => ({ type: "italic" }), group: 1 },
];

function inline(text: string, marks: Mark[] = []): DocNode[] {
  const out: DocNode[] = [];
  let rest = text;
  while (rest) {
    let best: { index: number; m: RegExpExecArray; pattern: (typeof INLINE)[number] } | null = null;
    for (const pattern of INLINE) {
      const m = pattern.re.exec(rest);
      if (m && (best === null || m.index < best.index)) best = { index: m.index, m, pattern };
    }
    if (!best) {
      out.push(textNode(rest, marks));
      break;
    }
    if (best.index > 0) out.push(textNode(rest.slice(0, best.index), marks));
    const mark = best.pattern.mark(best.m);
    const inner = best.m[best.pattern.group];
    if (mark?.type === "code") out.push(textNode(inner, [...marks, mark]));
    else if (mark?.type === "link" && typeof mark.attrs?.href === "string" && mark.attrs.href.startsWith(TASK_HREF) && mark.attrs.href.length > TASK_HREF.length) {
      out.push({ type: "taskLink", attrs: { taskId: mark.attrs.href.slice(TASK_HREF.length), title: inner } });
    } else out.push(...inline(inner, mark ? [...marks, mark] : marks));
    rest = rest.slice(best.index + best.m[0].length);
  }
  return out;
}

const textNode = (text: string, marks: Mark[]): DocNode => (marks.length ? { type: "text", text, marks } : { type: "text", text });

// ---------- Doc to Markdown ----------

export function docToMarkdown(doc: unknown): string {
  const root = doc as DocNode | null;
  if (!root || typeof root !== "object") return "";
  return renderBlocks(root.type === "doc" ? (root.content ?? []) : [root]).trim();
}

function renderBlocks(nodes: DocNode[]): string {
  return nodes.map(renderBlock).filter((s) => s !== "").join("\n\n");
}

function renderBlock(n: DocNode): string {
  switch (n.type) {
    case "paragraph":
      return renderInline(n.content);
    case "heading":
      return `${"#".repeat(Math.min(Math.max(Number(n.attrs?.level) || 1, 1), 3))} ${renderInline(n.content)}`;
    case "bulletList":
    case "orderedList":
    case "taskList":
      return (n.content ?? []).map((item, i) => renderItem(n, item, i)).join("\n");
    case "blockquote":
      return renderBlocks(n.content ?? [])
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    case "codeBlock": {
      const text = (n.content ?? []).map((c) => c.text ?? "").join("");
      const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((s) => s.length));
      const fence = "`".repeat(longest + 1);
      return `${fence}${typeof n.attrs?.language === "string" ? n.attrs.language : ""}\n${text}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    case "image":
      return `![${String(n.attrs?.alt ?? n.attrs?.title ?? "image")}](${String(n.attrs?.src ?? "")})`;
    default:
      return n.content ? renderBlocks(n.content) : renderInline([n]);
  }
}

function renderItem(list: DocNode, item: DocNode, index: number): string {
  const prefix =
    list.type === "orderedList"
      ? `${(Number(list.attrs?.start) || 1) + index}. `
      : list.type === "taskList"
        ? `- [${item.attrs?.checked ? "x" : " "}] `
        : "- ";
  const [head, ...rest] = (item.content ?? []).map(renderBlock);
  const pad = " ".repeat(prefix.length);
  const lines = [`${prefix}${head ?? ""}`, ...rest.flatMap((b) => b.split("\n").map((l) => (l ? pad + l : l)))];
  return lines.join("\n");
}

function renderInline(nodes: DocNode[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      if (n.type === "image") return `![${String(n.attrs?.alt ?? "image")}](${String(n.attrs?.src ?? "")})`;
      if (n.type === "taskLink") {
        const title = String(n.attrs?.title ?? "task").replace(/[[\]\n]/g, " ").trim() || "task";
        return `[${title}](${TASK_HREF}${String(n.attrs?.taskId ?? "")})`;
      }
      if (n.type !== "text") return n.content ? renderInline(n.content) : "";
      let s = n.text ?? "";
      const has = (t: string) => n.marks?.find((m) => m.type === t);
      if (has("code")) s = `\`${s}\``;
      else {
        if (has("strike")) s = `~~${s}~~`;
        if (has("italic")) s = `*${s}*`;
        if (has("bold")) s = `**${s}**`;
      }
      const link = has("link");
      if (link && typeof link.attrs?.href === "string") s = `[${s}](${link.attrs.href})`;
      return s;
    })
    .join("");
}
