import type { ActivityType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { formatActivity, relativeTime } from "@/lib/activity-format";
import { dateOnlyISO } from "@/lib/list-view";

const now = new Date(2026, 9, 1, 12, 0); // Thu 1 Oct 2026, 12:00 local
const labels = { s1: "To do", s2: "In progress", l1: "General", l2: "Design", u1: "Ben Member", t1: "Hero section", t2: "Homepage" };
const f = (type: ActivityType, payload: Record<string, unknown> = {}) => formatActivity({ type, payload, labels }, { now });

describe("formatActivity", () => {
  it("renders every ActivityType as a sentence", () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m).toISOString();
    const cases: [ActivityType, Record<string, unknown>, string][] = [
      ["TASK_CREATED", {}, "created the task"],
      ["TASK_RENAMED", { from: "Old", to: "New name" }, 'renamed the task to "New name"'],
      ["TASK_DESCRIPTION_CHANGED", {}, "updated the description"],
      ["STATUS_CHANGED", { from: "s1", to: "s2" }, "changed the status from To do to In progress"],
      ["PRIORITY_CHANGED", { from: 4, to: 1 }, "set priority to P1"],
      ["START_DATE_CHANGED", { from: null, to: dateOnlyISO(2026, 9, 2) }, "set the start date to Tomorrow"],
      ["DUE_DATE_CHANGED", { from: null, to: at(15, 30), toHasTime: true }, "set the due date to Today 3:30pm"],
      ["ASSIGNEE_ADDED", { userId: "u1" }, "assigned Ben Member"],
      ["ASSIGNEE_REMOVED", { userId: "u1" }, "unassigned Ben Member"],
      ["MOVED_TO_LIST", { fromListId: "l1", toListId: "l2" }, "moved the task from General to Design"],
      ["ADDED_TO_LIST", { listId: "l2" }, "added the task to Design"],
      ["REMOVED_FROM_LIST", { listId: "l2" }, "removed the task from Design"],
      ["SUBTASK_ADDED", { subtaskId: "t1" }, 'added the subtask "Hero section"'],
      ["PARENT_CHANGED", { from: null, to: "t2" }, 'made it a subtask of "Homepage"'],
      ["COMMENT_ADDED", { commentId: "c1" }, "commented"],
      ["SCHEDULED", { timeBlockId: "b1", start: at(10, 45), end: at(12) }, "scheduled it for Today 10:45–12:00"],
      ["UNSCHEDULED", { timeBlockId: "b1" }, "removed a scheduled time"],
      ["TASK_COMPLETED", {}, "completed the task"],
      ["TASK_REOPENED", {}, "reopened the task"],
      ["TASK_DELETED", {}, "deleted the task"],
      ["TASK_RESTORED", {}, "restored the task"],
    ];
    for (const [type, payload, text] of cases) expect(f(type, payload)).toBe(text);
    // Every enum value is covered above.
    expect(new Set(cases.map((c) => c[0])).size).toBe(21);
  });

  it("handles clears, unknown ids and long titles", () => {
    expect(f("PRIORITY_CHANGED", { from: 1, to: 4 })).toBe("removed the priority");
    expect(f("DUE_DATE_CHANGED", { from: "x", to: null })).toBe("removed the due date");
    expect(f("START_DATE_CHANGED", { from: "x", to: null })).toBe("removed the start date");
    expect(f("PARENT_CHANGED", { from: "t2", to: null })).toBe("converted it to a task");
    expect(f("STATUS_CHANGED", { from: "gone", to: "s2" })).toBe("changed the status from another status to In progress");
    expect(f("TASK_RENAMED", { to: "x".repeat(80) })).toBe(`renamed the task to "${"x".repeat(57)}…"`);
    expect(f("DUE_DATE_CHANGED", { to: dateOnlyISO(2026, 8, 28), toHasTime: false })).toBe("set the due date to Sep 28");
  });
});

describe("relativeTime", () => {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it("counts minutes, hours and days, then shows the date", () => {
    expect(relativeTime(ago(20_000), now)).toBe("just now");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(relativeTime(ago(2 * 3_600_000), now)).toBe("2h ago");
    expect(relativeTime(new Date(2026, 8, 30, 9).toISOString(), now)).toBe("yesterday");
    expect(relativeTime(new Date(2026, 8, 27, 9).toISOString(), now)).toBe("4d ago");
    expect(relativeTime(new Date(2026, 8, 2).toISOString(), now)).toBe("Sep 2");
    expect(relativeTime(new Date(2025, 11, 24).toISOString(), now)).toBe("Dec 24, 2025");
  });
});
