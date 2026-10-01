import { daysUntilDue } from "./list-view";

/*
 * My Tasks grouping (Section 9.5): Overdue, Today, Next 7 days, Later, No date. "Overdue" uses
 * formatDue's rule (a timed due is overdue once its time has passed; a date-only due once its day
 * has), so a row's red due label and its group always agree.
 */

export type MyTaskGroupKey = "overdue" | "today" | "next7" | "later" | "none";

export const MY_TASK_GROUPS: { key: MyTaskGroupKey; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "next7", label: "Next 7 days" },
  { key: "later", label: "Later" },
  { key: "none", label: "No date" },
];

type Groupable = { id: string; title: string; priority: number; dueDate: string | null; dueHasTime: boolean };

export function myTaskGroupOf(t: Groupable, now = new Date()): MyTaskGroupKey {
  if (!t.dueDate) return "none";
  const days = daysUntilDue(t.dueDate, t.dueHasTime, now);
  const overdue = t.dueHasTime ? new Date(t.dueDate).getTime() < now.getTime() : days < 0;
  if (overdue) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "next7";
  return "later";
}

/**
 * All five groups in order (empty ones included; the UI hides them). Within a group: by due day,
 * all-day before timed on the same day, then time, priority (P1 first) and title. No date: by
 * priority, then title.
 */
export function groupMyTasks<T extends Groupable>(
  tasks: readonly T[],
  now = new Date(),
): { key: MyTaskGroupKey; label: string; tasks: T[] }[] {
  const byKey = new Map<MyTaskGroupKey, T[]>(MY_TASK_GROUPS.map((g) => [g.key, []]));
  for (const t of tasks) byKey.get(myTaskGroupOf(t, now))!.push(t);
  const sortKey = (t: T) =>
    t.dueDate
      ? [daysUntilDue(t.dueDate, t.dueHasTime, now), t.dueHasTime ? 1 : 0, t.dueHasTime ? new Date(t.dueDate).getTime() : 0]
      : [0, 0, 0];
  const compare = (a: T, b: T) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.priority - b.priority || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  };
  return MY_TASK_GROUPS.map((g) => ({ ...g, tasks: byKey.get(g.key)!.sort(compare) }));
}
