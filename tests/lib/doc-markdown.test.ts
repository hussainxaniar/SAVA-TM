import { describe, expect, it } from "vitest";
import { docToMarkdown, markdownToDoc } from "@/lib/doc-markdown";
import { docToPlain } from "@/lib/plain-to-doc";

const types = (md: string) => markdownToDoc(md).content.map((n) => n.type);

describe("markdownToDoc", () => {
  it("reads headings (capped at level 3), paragraphs with line breaks, rules and quotes", () => {
    const doc = markdownToDoc("# Title\n\nFirst line\nsecond line\n\n#### Deep\n\n---\n\n> quoted\n> more");
    expect(doc.content.map((n) => n.type)).toEqual(["heading", "paragraph", "heading", "horizontalRule", "blockquote"]);
    expect(doc.content[0].attrs).toEqual({ level: 1 });
    expect(doc.content[2].attrs).toEqual({ level: 3 });
    expect(doc.content[1].content?.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
  });

  it("reads inline marks, nested marks and links, and leaves code literal", () => {
    const [p] = markdownToDoc("**bold with *nested italic* inside** ~~gone~~ `a *b*` [site](https://x.test/a)").content;
    const parts = p.content!;
    expect(parts[0]).toMatchObject({ text: "bold with ", marks: [{ type: "bold" }] });
    expect(parts[1]).toMatchObject({ text: "nested italic", marks: [{ type: "bold" }, { type: "italic" }] });
    expect(parts[2]).toMatchObject({ text: " inside", marks: [{ type: "bold" }] });
    expect(parts.find((n) => n.text === "gone")?.marks).toEqual([{ type: "strike" }]);
    expect(parts.find((n) => n.text === "a *b*")?.marks).toEqual([{ type: "code" }]);
    expect(parts.find((n) => n.text === "site")?.marks).toEqual([{ type: "link", attrs: { href: "https://x.test/a" } }]);
  });

  it("does not turn snake_case or math into italics", () => {
    const [p] = markdownToDoc("use my_file_name and 2 * 3 * 4").content;
    expect(p.content).toEqual([{ type: "text", text: "use my_file_name and 2 * 3 * 4" }]);
  });

  it("reads bullet, numbered and task lists, nested", () => {
    const doc = markdownToDoc("- one\n  - nested\n- two\n\n3. third\n4. fourth\n\n- [ ] todo\n- [x] done");
    expect(doc.content.map((n) => n.type)).toEqual(["bulletList", "orderedList", "taskList"]);
    const bullets = doc.content[0];
    expect(bullets.content).toHaveLength(2);
    expect(bullets.content![0].content!.map((n) => n.type)).toEqual(["paragraph", "bulletList"]);
    expect(doc.content[1].attrs).toEqual({ start: 3 });
    expect(doc.content[2].content!.map((n) => n.attrs)).toEqual([{ checked: false }, { checked: true }]);
  });

  it("reads fenced code (kept verbatim, even blank lines and markdown inside) and keeps pipe tables as code", () => {
    const doc = markdownToDoc("```ts\nconst a = 1;\n\n# not a heading\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |");
    expect(doc.content.map((n) => n.type)).toEqual(["codeBlock", "codeBlock"]);
    expect(doc.content[0]).toMatchObject({ attrs: { language: "ts" }, content: [{ text: "const a = 1;\n\n# not a heading" }] });
    expect(doc.content[1].content![0].text).toBe("| a | b |\n| - | - |\n| 1 | 2 |");
  });

  it("reads a block image and gives an empty doc for blank input", () => {
    expect(markdownToDoc("![diagram](/api/images/abc)").content[0]).toEqual({ type: "image", attrs: { src: "/api/images/abc", alt: "diagram" } });
    expect(markdownToDoc("  \n\n ")).toEqual({ type: "doc", content: [] });
    expect(types("text right after\n- a list")).toEqual(["paragraph", "bulletList"]);
  });
});

describe("docToMarkdown", () => {
  it("round-trips the supported syntax", () => {
    const md = [
      "# Title",
      "",
      "Some **bold**, *italic*, ~~strike~~, `code` and a [link](https://x.test).",
      "",
      "## Steps",
      "",
      "1. first",
      "2. second",
      "   - nested",
      "",
      "- [ ] open",
      "- [x] closed",
      "",
      "> a quote",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
      "---",
      "",
      "![diagram](/api/images/abc)",
    ].join("\n");
    expect(docToMarkdown(markdownToDoc(md))).toBe(md);
  });

  it("is safe on empty or odd input", () => {
    expect(docToMarkdown(null)).toBe("");
    expect(docToMarkdown({ type: "doc" })).toBe("");
    expect(docToMarkdown({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
  });
});

describe("docToPlain with images", () => {
  it("shows an image as a placeholder instead of dropping it", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "See:" }] }, { type: "image", attrs: { src: "/api/images/x", alt: "Table columns" } }, { type: "image", attrs: { src: "/api/images/y" } }] };
    expect(docToPlain(doc)).toBe("See:\n[image: Table columns]\n[image]");
  });
});
