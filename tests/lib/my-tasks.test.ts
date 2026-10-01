import { describe, expect, it } from "vitest";
import { dateOnlyISO } from "@/lib/list-view";
import { groupMyTasks, myTaskGroupOf } from "@/lib/my-tasks";

const now = new Date(2026, 9, 1, 12, 0); // Thu 1 Oct 2026, 12:00 local
const day = (d: number) => dateOnlyISO(2026, 9, d);
const at = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();
const t = (id: string, dueDate: string | null, dueHasTime = false, priority = 4) => ({ id, title: id, priority, dueDate, dueHasTime });

describe("myTaskGroupOf", () => {
  it("buckets by due day, with timed dues overdue once their time passes", () => {
    expect(myTaskGroupOf(t("a", dateOnlyISO(2026, 8, 30)), now)).toBe("overdue"); // 30 Sep
    expect(myTaskGroupOf(t("b", at(1, 9), true), now)).toBe("overdue"); // today 09:00, now 12:00
    expect(myTaskGroupOf(t("c", at(1, 15), true), now)).toBe("today");
    expect(myTaskGroupOf(t("d", day(1)), now)).toBe("today");
    expect(myTaskGroupOf(t("e", day(2)), now)).toBe("next7");
    expect(myTaskGroupOf(t("f", day(8)), now)).toBe("next7");
    expect(myTaskGroupOf(t("g", day(9)), now)).toBe("later");
    expect(myTaskGroupOf(t("h", null), now)).toBe("none");
  });
});

describe("groupMyTasks", () => {
  it("returns the five groups in order, each sorted", () => {
    const groups = groupMyTasks(
      [
        t("later", day(20)),
        t("none-p3", null, false, 3),
        t("none-p1", null, false, 1),
        t("today-3pm", at(1, 15), true),
        t("today-allday", day(1)),
        t("soon-p2", day(3), false, 2),
        t("soon-p1", day(3), false, 1),
        t("tomorrow", day(2)),
        t("late", dateOnlyISO(2026, 8, 28)), // 28 Sep
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.tasks.map((x) => x.id)])).toEqual([
      ["Overdue", ["late"]],
      ["Today", ["today-allday", "today-3pm"]],
      ["Next 7 days", ["tomorrow", "soon-p1", "soon-p2"]],
      ["Later", ["later"]],
      ["No date", ["none-p1", "none-p3"]],
    ]);
  });
});
