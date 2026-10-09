// Section 15.4. API clients send and read plain text; the app stores Tiptap JSON.
// In: blank lines separate paragraphs, a single newline is a line break, and consecutive
// lines starting with "- " or "* " become a bullet list. Out: blocks on their own lines, list
// items prefixed with "- ".

type Node = { type: string; content?: Node[]; text?: string; attrs?: Record<string, unknown> };

const BULLET = /^\s*[-*]\s+(.*)$/;

function inline(text: string): Node[] {
  const out: Node[] = [];
  text.split("\n").forEach((line, i) => {
    if (i > 0) out.push({ type: "hardBreak" });
    if (line) out.push({ type: "text", text: line });
  });
  return out;
}

function paragraph(text: string): Node {
  const content = inline(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/** A Tiptap `doc` for the text. Empty or whitespace-only input gives an empty doc. */
export function plainToDoc(text: string): { type: "doc"; content: Node[] } {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.replace(/^\n+|\n+$/g, ""))
    .filter((b) => b.trim() !== "");

  const content: Node[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    // A leading paragraph line followed by bullets is common ("Steps:\n- a\n- b"): split at the first bullet.
    const firstBullet = lines.findIndex((l) => BULLET.test(l));
    if (firstBullet === -1) {
      content.push(paragraph(block));
      continue;
    }
    if (firstBullet > 0) content.push(paragraph(lines.slice(0, firstBullet).join("\n")));
    const items: Node[] = [];
    for (const line of lines.slice(firstBullet)) {
      const m = BULLET.exec(line);
      if (m) items.push({ type: "listItem", content: [paragraph(m[1])] });
      else if (items.length) {
        // A continuation line belongs to the previous item.
        const last = items[items.length - 1].content![0];
        last.content = [...(last.content ?? []), { type: "hardBreak" }, { type: "text", text: line.trim() }];
      }
    }
    content.push({ type: "bulletList", content: items });
  }
  return { type: "doc", content };
}

/** Plain text for any Tiptap value (null/unknown gives ""). */
export function docToPlain(doc: unknown): string {
  return blocks(doc).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function blocks(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const n = node as Node;
  switch (n.type) {
    case "doc":
      return (n.content ?? []).flatMap((c) => blocks(c));
    case "bulletList":
    case "orderedList":
    case "taskList":
      return (n.content ?? []).flatMap((c) => blocks(c));
    case "listItem":
    case "taskItem": {
      const [first = "", ...rest] = (n.content ?? []).flatMap((c) => blocks(c));
      return [`- ${first}`, ...rest.map((r) => `  ${r}`)];
    }
    case "paragraph":
    case "heading":
    case "codeBlock":
    case "blockquote": {
      return [inlineText(n)];
    }
    case "image": {
      // Not readable as text, but an agent should know it is there (and what it is called).
      const alt = typeof n.attrs?.alt === "string" && n.attrs.alt.trim() ? n.attrs.alt.trim() : "";
      return [alt ? `[image: ${alt}]` : "[image]"];
    }
    default:
      return n.content ? n.content.flatMap((c) => blocks(c)) : [];
  }
}

function inlineText(n: Node): string {
  if (n.type === "hardBreak") return "\n";
  if (typeof n.text === "string") return n.text;
  return (n.content ?? []).map(inlineText).join("");
}
