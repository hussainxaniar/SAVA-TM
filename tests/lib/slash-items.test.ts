import { describe, expect, it } from "vitest";
import { SLASH_ITEMS, filterSlashItems, groupSlashItems } from "@/lib/slash-items";

const ids = (q: string, available?: Parameters<typeof filterSlashItems>[1]) => filterSlashItems(q, available).map((i) => i.id);

describe("filterSlashItems", () => {
  it("gives every item in group order for an empty query", () => {
    expect(ids("")).toEqual(SLASH_ITEMS.map((i) => i.id));
    expect(ids("   ")).toHaveLength(SLASH_ITEMS.length);
  });

  it("matches the title by prefix, word start or keyword, case-insensitively", () => {
    expect(ids("head")).toEqual(["h1", "h2", "h3"]);
    expect(ids("HEADING 2")).toEqual(["h2"]); // a full title still finds it
    expect(ids("h2")).toEqual(["h2"]);
    expect(ids("list")).toEqual(["bullet", "numbered", "todo"]); // titles with the word "list" first, then keywords
    expect(ids("ul")).toEqual(["bullet"]);
    expect(ids("check")).toEqual(["todo"]);
    expect(ids("todo")).toEqual(["todo"]); // people type it without the dash
    expect(ids("to-do")).toEqual(["todo"]);
    expect(ids("pic")).toEqual(["image"]);
    expect(ids("xyz")).toEqual([]);
  });

  it("ranks a title that starts with the query above one that merely contains it", () => {
    expect(ids("code")[0]).toBe("code");
    expect(ids("to")).toEqual(["todo"]); // "To-do list" starts with "to"; "separator" and "photo" only contain it
    expect(ids("rule")).toEqual(["divider"]); // a keyword that starts with the query
  });

  it("drops the items the editor cannot do", () => {
    const noTaskNoImage = (i: { id: string }) => i.id !== "task" && i.id !== "image";
    expect(ids("", noTaskNoImage)).not.toContain("task");
    expect(ids("", noTaskNoImage)).not.toContain("image");
    expect(ids("link", noTaskNoImage)).toEqual([]);
  });
});

describe("groupSlashItems", () => {
  it("groups in first-seen order and keeps the items' order", () => {
    const groups = groupSlashItems(filterSlashItems(""));
    expect(groups.map((g) => g.group)).toEqual(["Basic blocks", "Media", "Tasks"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["text", "h1", "h2", "h3", "bullet", "numbered", "todo", "quote", "code", "divider"]);
    expect(groupSlashItems([])).toEqual([]);
  });
});
