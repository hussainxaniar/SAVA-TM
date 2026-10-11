import { describe, expect, it } from "vitest";
import { orderRailTasks } from "@/lib/calendar-rail";

const t = (id: string, nextBlockStart: string | null = null) => ({ id, nextBlockStart });

describe("orderRailTasks", () => {
  it("puts unscheduled tasks first in their given order, then scheduled ones by next slot", () => {
    const tasks = [t("a", "2026-10-12T14:00:00Z"), t("b"), t("c", "2026-10-12T10:00:00Z"), t("d")];
    expect(orderRailTasks(tasks).map((x) => x.id)).toEqual(["b", "d", "c", "a"]);
  });

  it("moves a task that just got a slot below the unscheduled ones", () => {
    const before = [t("plan"), t("review")];
    const marked = before.map((x) => (x.id === "plan" ? { ...x, nextBlockStart: "2026-10-12T10:00:00Z" } : x));
    expect(orderRailTasks(marked).map((x) => x.id)).toEqual(["review", "plan"]);
  });
});
