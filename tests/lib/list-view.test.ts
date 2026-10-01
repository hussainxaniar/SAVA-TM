import { describe, expect, it } from "vitest";
import {
  avatarColors,
  buildGroups,
  dateOnlyFromLocal,
  dateOnlyISO,
  formatDue,
  initials,
  localDayOf,
  localTimeOf,
  monthGrid,
  parentCandidates,
  quickDays,
  sameDay,
  withLocalTime,
} from "@/lib/list-view";
import type { StatusDTO, TaskRowDTO } from "@/server/services/types";

const statuses: StatusDTO[] = [
  { id: "todo", name: "To do", color: "#94A3B8", category: "TODO", position: "a0" },
  { id: "doing", name: "In progress", color: "#3B82F6", category: "ACTIVE", position: "a1" },
  { id: "done", name: "Done", color: "#22C55E", category: "DONE", position: "a2" },
];
const byId = Object.fromEntries(statuses.map((s) => [s.id, s]));

function task(id: string, over: Omit<Partial<TaskRowDTO>, "status"> & { status?: string } = {}): TaskRowDTO {
  const { status = "todo", ...rest } = over;
  return {
    id,
    title: id,
    priority: 4,
    status: byId[status],
    completedAt: status === "done" ? "2026-09-01T00:00:00.000Z" : null,
    startDate: null,
    dueDate: null,
    dueHasTime: false,
    linkedListIds: [],
    assignees: [],
    parentId: null,
    parentTitle: null,
    depth: 0,
    homeListId: "L",
    isLinkedHere: false,
    subtaskCount: 0,
    openSubtaskCount: 0,
    commentCount: 0,
    position: "a0",
    ...rest,
  };
}

// A (todo) → a1 (done), a2 (todo) → a2x (todo); B (doing); C (done); L = linked subtask of an absent parent
const tasks = [
  task("B", { status: "doing", position: "a1" }),
  task("A", { position: "a0", priority: 2, dueDate: "2026-10-05T00:00:00.000Z" }),
  task("a2", { parentId: "A", parentTitle: "A", depth: 1, position: "a1", priority: 1 }),
  task("a1", { parentId: "A", parentTitle: "A", depth: 1, position: "a0", status: "done" }),
  task("a2x", { parentId: "a2", parentTitle: "a2", depth: 2, position: "a0" }),
  task("C", { status: "done", position: "a2" }),
  task("L", { parentId: "elsewhere", parentTitle: "Elsewhere", depth: 1, position: "zz", isLinkedHere: true, dueDate: "2026-10-01T00:00:00.000Z" }),
];
const shape = (groups: ReturnType<typeof buildGroups>) =>
  groups.map((g) => [g.status.id, g.count, g.rows.map((r) => `${"-".repeat(r.indent)}${r.task.id}${r.showParent ? "^" : ""}`)]);

describe("buildGroups — NESTED", () => {
  it("groups roots by status with subtrees under them, whatever the children's status", () => {
    expect(shape(buildGroups(tasks, statuses, { mode: "NESTED", sort: "manual" }))).toEqual([
      ["todo", 2, ["A", "-a1", "-a2", "--a2x", "L^"]],
      ["doing", 1, ["B"]],
      ["done", 1, ["C"]],
    ]);
  });

  it("marks parents and hides collapsed subtrees", () => {
    const groups = buildGroups(tasks, statuses, { mode: "NESTED", sort: "manual", collapsed: new Set(["a2"]) });
    const todo = groups[0].rows;
    expect(todo.map((r) => [r.task.id, r.hasChildren])).toEqual([
      ["A", true],
      ["a1", false],
      ["a2", true],
      ["L", false],
    ]);
  });

  it("sorts roots and siblings by priority or due date (no date last)", () => {
    expect(shape(buildGroups(tasks, statuses, { mode: "NESTED", sort: "priority" }))[0][2]).toEqual([
      "A",
      "-a2",
      "--a2x",
      "-a1",
      "L^",
    ]);
    expect(shape(buildGroups(tasks, statuses, { mode: "NESTED", sort: "due" }))[0][2]).toEqual(["L^", "A", "-a1", "-a2", "--a2x"]);
  });

  it("keeps empty statuses as empty groups", () => {
    expect(shape(buildGroups([], statuses, { mode: "NESTED", sort: "manual" }))).toEqual([
      ["todo", 0, []],
      ["doing", 0, []],
      ["done", 0, []],
    ]);
  });
});

describe("buildGroups — SEPARATE", () => {
  it("gives every task its own row in its own status group, depth-first in manual order", () => {
    expect(shape(buildGroups(tasks, statuses, { mode: "SEPARATE", sort: "manual" }))).toEqual([
      ["todo", 4, ["A", "a2^", "a2x^", "L^"]],
      ["doing", 1, ["B"]],
      ["done", 2, ["a1^", "C"]],
    ]);
  });

  it("ranks rows on their own for due-date sort", () => {
    expect(shape(buildGroups(tasks, statuses, { mode: "SEPARATE", sort: "due" }))[0][2]).toEqual(["L^", "A", "a2^", "a2x^"]);
  });
});

describe("formatDue", () => {
  // Wednesday 30 Sep 2026, 10:00 local
  const now = new Date(2026, 8, 30, 10, 0);

  it("reads date-only values as calendar days (UTC midnight), whatever the local offset", () => {
    expect(formatDue(dateOnlyISO(2026, 8, 30), false, { now })).toEqual({ label: "Today", tone: "today" });
    expect(formatDue(dateOnlyISO(2026, 9, 1), false, { now })).toEqual({ label: "Tomorrow", tone: "default" });
    expect(formatDue(dateOnlyISO(2026, 8, 29), false, { now })).toEqual({ label: "Yesterday", tone: "overdue" });
    expect(formatDue(dateOnlyISO(2026, 9, 12), false, { now })).toEqual({ label: "Oct 12", tone: "default" });
    expect(formatDue(dateOnlyISO(2027, 0, 3), false, { now })).toEqual({ label: "Jan 3, 2027", tone: "default" });
    expect(formatDue(dateOnlyISO(2026, 8, 20), false, { now })).toEqual({ label: "Sep 20", tone: "overdue" });
  });

  it("shows times in local time and compares timed values to the instant", () => {
    expect(formatDue(new Date(2026, 8, 30, 15, 0).toISOString(), true, { now })).toEqual({ label: "Today 3pm", tone: "today" });
    expect(formatDue(new Date(2026, 8, 30, 9, 30).toISOString(), true, { now })).toEqual({ label: "Today 9:30am", tone: "overdue" });
    expect(formatDue(new Date(2026, 9, 2, 0, 0).toISOString(), true, { now })).toEqual({ label: "Oct 2 12am", tone: "default" });
  });

  it("never marks completed tasks as overdue or today", () => {
    expect(formatDue(dateOnlyISO(2026, 8, 20), false, { now, completed: true }).tone).toBe("default");
  });
});

describe("avatars", () => {
  it("derives initials and a stable color per user", () => {
    expect(initials("Hussain Xaniar")).toBe("HX");
    expect(initials("ada")).toBe("A");
    expect(initials("  ")).toBe("?");
    expect(avatarColors("user-1")).toEqual(avatarColors("user-1"));
  });
});

describe("parentCandidates", () => {
  // A ─ B ─ C ; D ─ E ; F
  const t = (id: string, parentId: string | null, depth: number) => ({ id, parentId, depth });
  const tasks = [t("A", null, 0), t("B", "A", 1), t("C", "B", 2), t("D", null, 0), t("E", "D", 1), t("F", null, 0), t("temp-1", null, 0)];
  const ids = (taskId: string) => parentCandidates(tasks, taskId).map((x) => x.id);

  it("offers roots and depth-1 tasks for a leaf, never itself, its parent or temp rows", () => {
    expect(ids("F")).toEqual(["A", "B", "D", "E"]);
    expect(ids("E")).toEqual(["A", "B", "F"]); // not D (current parent)
  });

  it("leaves room for the subtree and blocks cycles", () => {
    expect(ids("B")).toEqual(["D", "F"]); // B has one level below: only roots fit; not A (parent), not C (descendant)
    expect(ids("A")).toEqual([]); // two levels below: nothing fits
    expect(ids("missing")).toEqual([]);
  });
});

describe("date picker helpers", () => {
  it("round-trips date-only and timed values through local days", () => {
    const day = new Date(2026, 9, 3); // Sat 3 Oct 2026, local
    const stored = dateOnlyFromLocal(day);
    expect(stored).toBe(dateOnlyISO(2026, 9, 3));
    expect(sameDay(localDayOf(stored, false), day)).toBe(true);
    expect(formatDue(stored, false, { now: new Date(2026, 9, 2, 9) }).label).toBe("Tomorrow");

    const timed = withLocalTime(day, "15:30");
    expect(localTimeOf(timed)).toBe("15:30");
    expect(sameDay(localDayOf(timed, true), day)).toBe(true);
  });

  it("offers Today, Tomorrow, next Monday and next Saturday", () => {
    const wed = new Date(2026, 8, 30, 18, 0); // Wednesday
    const [today, tomorrow, nextWeek, weekend] = quickDays(wed).map((q) => q.day);
    expect([today, tomorrow, nextWeek, weekend].map((d) => d.getDate())).toEqual([30, 1, 5, 3]);
    // On a Monday "Next week" is the following Monday, not today.
    expect(quickDays(new Date(2026, 9, 5))[2].day.getDate()).toBe(12);
  });

  it("builds a Monday-first 6-week grid", () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(sameDay(grid[3], new Date(2026, 9, 1))).toBe(true);
  });
});
