import { describe, expect, it } from "vitest";
import {
  activeMention,
  applyMention,
  listHandle,
  memberHandle,
  parseQuickAdd,
  tokenKey,
} from "@/lib/quick-add-parser";
import { dateOnlyISO } from "@/lib/list-view";

// Wednesday 30 September 2026, 10:00 local time. Expected values are built from local
// components too, so the tests pass in any time zone.
const now = new Date(2026, 8, 30, 10, 0);
const day = (y: number, m: number, d: number) => dateOnlyISO(y, m - 1, d);
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

const members = [
  { id: "u-ada", name: "Ada Lovelace" },
  { id: "u-ahmad", name: "Ahmad Karimi" },
  { id: "u-sam1", name: "Sam Stone" },
  { id: "u-sam2", name: "Sam Rivera" },
];
const lists = [
  { id: "l-backlog", name: "Backlog" },
  { id: "l-design", name: "Design review" },
];
const parse = (text: string, ignore?: string[]) => parseQuickAdd(text, { now, members, lists, ignore });

describe("parseQuickAdd: no tokens", () => {
  it("keeps plain text as the title", () => {
    expect(parse("Write the brief")).toEqual({
      title: "Write the brief",
      dueDate: null,
      dueHasTime: false,
      priority: null,
      assigneeIds: [],
      listId: null,
      tokens: [],
    });
  });

  it("collapses whitespace and trims", () => {
    expect(parse("  Write   the brief  ").title).toBe("Write the brief");
  });

  it("returns an empty title when the text is only tokens", () => {
    const r = parse("tomorrow p1");
    expect(r.title).toBe("");
    expect(r.priority).toBe(1);
    expect(r.dueDate).toBe(day(2026, 10, 1));
  });
});

describe("parseQuickAdd: dates", () => {
  it("parses tomorrow as a date-only due date", () => {
    const r = parse("Write brief tomorrow");
    expect(r.title).toBe("Write brief");
    expect(r.dueDate).toBe(day(2026, 10, 1));
    expect(r.dueHasTime).toBe(false);
  });

  it("parses a weekday with a time", () => {
    const r = parse("Call mom fri 3pm");
    expect(r.title).toBe("Call mom");
    expect(r.dueDate).toBe(at(2026, 10, 2, 15));
    expect(r.dueHasTime).toBe(true);
  });

  it("parses next week and in N days", () => {
    expect(parse("Plan next week").dueDate).toBe(day(2026, 10, 7));
    expect(parse("Follow up in 3 days").dueDate).toBe(day(2026, 10, 3));
  });

  it("parses a month and day, and a time before the day", () => {
    expect(parse("Pay rent oct 12").dueDate).toBe(day(2026, 10, 12));
    const r = parse("Standup 9:30am tomorrow");
    expect(r.title).toBe("Standup");
    expect(r.dueDate).toBe(at(2026, 10, 1, 9, 30));
  });

  it("removes a preposition right before the date", () => {
    expect(parse("Email Bob by monday").title).toBe("Email Bob");
    expect(parse("Ship on friday").title).toBe("Ship");
    expect(parse("Email Bob by monday").dueDate).toBe(day(2026, 10, 5));
  });

  it("ignores a bare month and the word now", () => {
    const march = parse("Review March report");
    expect(march.dueDate).toBeNull();
    expect(march.title).toBe("Review March report");
    expect(parse("Buy now pay later research").dueDate).toBeNull();
  });

  it("uses the first date and leaves later ones in the title", () => {
    const r = parse("Tomorrow prepare friday demo");
    expect(r.dueDate).toBe(day(2026, 10, 1));
    expect(r.title).toBe("prepare friday demo");
  });
});

describe("parseQuickAdd: priority", () => {
  it("parses p1–p4 case-insensitively", () => {
    expect(parse("Fix login p1").priority).toBe(1);
    expect(parse("Fix login P3").priority).toBe(3);
    expect(parse("Fix login P3").title).toBe("Fix login");
  });

  it("only counts whole words and the first one", () => {
    expect(parse("Upgrade p5 cluster").priority).toBeNull();
    expect(parse("Read p1x notes").priority).toBeNull();
    const r = parse("p2 fix p1 bug");
    expect(r.priority).toBe(2);
    expect(r.title).toBe("fix p1 bug");
  });
});

describe("parseQuickAdd: assignees", () => {
  it("resolves first-name handles and removes them", () => {
    const r = parse("Review copy @ada @ahmad");
    expect(r.assigneeIds).toEqual(["u-ada", "u-ahmad"]);
    expect(r.title).toBe("Review copy");
  });

  it("needs the full name when first names are shared", () => {
    expect(parse("Pair @sam").assigneeIds).toEqual([]);
    expect(parse("Pair @sam").title).toBe("Pair @sam");
    expect(parse("Pair @samrivera").assigneeIds).toEqual(["u-sam2"]);
    expect(parse("Pair @AdaLovelace").assigneeIds).toEqual(["u-ada"]);
  });

  it("ignores emails, unknown handles, duplicates and trailing punctuation", () => {
    expect(parse("Mail me@ada.com").assigneeIds).toEqual([]);
    expect(parse("Ask @bob").title).toBe("Ask @bob");
    expect(parse("Ask @ada and @ada").assigneeIds).toEqual(["u-ada"]);
    const r = parse("Ask @ada.");
    expect(r.assigneeIds).toEqual(["u-ada"]);
    expect(r.title).toBe("Ask .");
  });
});

describe("parseQuickAdd: lists", () => {
  it("resolves #handle to a list in the project", () => {
    const r = parse("Mock the header #design-review");
    expect(r.listId).toBe("l-design");
    expect(r.title).toBe("Mock the header");
  });

  it("leaves unknown hashtags in the title", () => {
    const r = parse("Fix #123 crash");
    expect(r.listId).toBeNull();
    expect(r.title).toBe("Fix #123 crash");
  });
});

describe("parseQuickAdd: combinations", () => {
  it("parses everything at once", () => {
    const r = parse("Write brief tomorrow p1 @ada #backlog");
    expect(r).toMatchObject({
      title: "Write brief",
      dueDate: day(2026, 10, 1),
      priority: 1,
      assigneeIds: ["u-ada"],
      listId: "l-backlog",
    });
    expect(r.tokens.map((t) => t.kind)).toEqual(["date", "priority", "assignee", "list"]);
  });

  it("does not read dates inside other tokens", () => {
    const r = parseQuickAdd("Sync #today", { now, lists: [{ id: "l-today", name: "Today" }] });
    expect(r.listId).toBe("l-today");
    expect(r.dueDate).toBeNull();
  });

  it("keeps dismissed tokens as text", () => {
    const first = parse("Launch party friday p2");
    const date = first.tokens.find((t) => t.kind === "date")!;
    const r = parse("Launch party friday p2", [tokenKey(date)]);
    expect(r.dueDate).toBeNull();
    expect(r.priority).toBe(2);
    expect(r.title).toBe("Launch party friday");
  });
});

describe("handles", () => {
  it("builds member and list handles", () => {
    expect(memberHandle(members[0], members)).toBe("ada");
    expect(memberHandle(members[2], members)).toBe("samstone");
    expect(listHandle(lists[1])).toBe("design-review");
  });
});

describe("activeMention / applyMention", () => {
  it("finds the @ or # word at the caret", () => {
    expect(activeMention("Ask @ad", 7)).toEqual({ kind: "assignee", query: "ad", start: 4, end: 7 });
    expect(activeMention("Ask #", 5)).toEqual({ kind: "list", query: "", start: 4, end: 5 });
    expect(activeMention("Ask @ad later", 6)).toEqual({ kind: "assignee", query: "a", start: 4, end: 7 });
    expect(activeMention("Mail me@x", 9)).toBeNull();
    expect(activeMention("Ask @ada now", 12)).toBeNull();
  });

  it("replaces the word with the handle and a space", () => {
    const mention = activeMention("Ask @ad later", 7)!;
    expect(applyMention("Ask @ad later", mention, "ada")).toEqual({ text: "Ask @ada later", caret: 9 });
    const end = activeMention("Ask #de", 7)!;
    expect(applyMention("Ask #de", end, "design-review")).toEqual({ text: "Ask #design-review ", caret: 19 });
  });
});
