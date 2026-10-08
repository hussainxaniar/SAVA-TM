import { describe, expect, it } from "vitest";
import { docToPlain, plainToDoc } from "@/lib/plain-to-doc";

describe("plainToDoc", () => {
  it("turns blank-line separated text into paragraphs and single newlines into line breaks", () => {
    expect(plainToDoc("One\ntwo\n\nThree")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "One" }, { type: "hardBreak" }, { type: "text", text: "two" }] },
        { type: "paragraph", content: [{ type: "text", text: "Three" }] },
      ],
    });
  });

  it("makes bullet lists, with a lead-in paragraph split off", () => {
    const doc = plainToDoc("Steps:\n- first\n* second");
    expect(doc.content.map((n) => n.type)).toEqual(["paragraph", "bulletList"]);
    expect(doc.content[1].content).toHaveLength(2);
  });

  it("gives an empty doc for blank input", () => {
    expect(plainToDoc("  \n\n ")).toEqual({ type: "doc", content: [] });
  });
});

describe("docToPlain", () => {
  it("round-trips paragraphs and bullets", () => {
    const text = "Intro line\n\nSteps:\n- first\n- second";
    expect(docToPlain(plainToDoc(text))).toBe("Intro line\nSteps:\n- first\n- second");
  });

  it("handles null, unknown values and hard breaks", () => {
    expect(docToPlain(null)).toBe("");
    expect(docToPlain("x")).toBe("");
    expect(docToPlain(plainToDoc("a\nb"))).toBe("a\nb");
  });
});
