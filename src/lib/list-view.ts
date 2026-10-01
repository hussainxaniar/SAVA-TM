import { comparePositions } from "@/lib/position";
import type { StatusDTO, TaskRowDTO } from "@/server/services/types";

/*
 * Pure helpers for the list view (6.7 + the Paper "List view" design): status groups, the
 * NESTED tree / SEPARATE flat rows, sorting, due-date labels and avatar colors. No React.
 */

export type DisplayMode = "NESTED" | "SEPARATE";
export type SortMode = "manual" | "due" | "priority";

export type ListRow = {
  task: TaskRowDTO;
  /** Indent level inside the group: 0 for roots; 1–2 for nested subtasks (NESTED only). */
  indent: number;
  /** NESTED: has visible children (shows the expand chevron). */
  hasChildren: boolean;
  /** Show the muted "↳ Parent title" line (6.7): linked-subtask roots, and every subtask in SEPARATE. */
  showParent: boolean;
};

export type StatusGroup = {
  status: StatusDTO;
  rows: ListRow[];
  /** Header count: roots in NESTED, rows in SEPARATE. */
  count: number;
};

/**
 * Groups `tasks` (Visible(L) from getListView) by status, in status order. NESTED puts each root
 * in its own status's group with its subtree beneath it (children follow the parent, whatever
 * their status); tasks in `collapsed` hide their descendants. SEPARATE gives every task its own
 * row in its own status's group. Every status gets a group, even when empty.
 */
export function buildGroups(
  tasks: readonly TaskRowDTO[],
  statuses: readonly StatusDTO[],
  opts: { mode: DisplayMode; sort: SortMode; collapsed?: ReadonlySet<string> },
): StatusGroup[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const children = new Map<string, TaskRowDTO[]>();
  const roots: TaskRowDTO[] = [];
  for (const t of tasks) {
    if (t.parentId && byId.has(t.parentId)) {
      const list = children.get(t.parentId) ?? [];
      list.push(t);
      children.set(t.parentId, list);
    } else {
      roots.push(t);
    }
  }
  const key = keyComparator(opts.sort);
  // Siblings (and roots) share one ordering space, so position is a meaningful tiebreak.
  const sorted = (list: TaskRowDTO[]) => [...list].sort((a, b) => key(a, b) || byPosition(a, b));

  const groups = new Map<string, StatusGroup>(
    [...statuses]
      .sort((a, b) => comparePositions(a.position, b.position))
      .map((status) => [status.id, { status, rows: [], count: 0 }]),
  );
  const groupFor = (t: TaskRowDTO) => {
    let g = groups.get(t.status.id);
    if (!g) {
      // A status we weren't sent (shouldn't happen); keep the task visible anyway.
      g = { status: t.status, rows: [], count: 0 };
      groups.set(t.status.id, g);
    }
    return g;
  };

  if (opts.mode === "NESTED") {
    const collapsed = opts.collapsed ?? new Set<string>();
    const walk = (t: TaskRowDTO, indent: number, group: StatusGroup, isRoot: boolean) => {
      const kids = children.get(t.id) ?? [];
      group.rows.push({
        task: t,
        indent,
        hasChildren: kids.length > 0,
        showParent: isRoot && t.parentId !== null,
      });
      if (collapsed.has(t.id)) return;
      for (const k of sorted(kids)) walk(k, indent + 1, group, false);
    };
    for (const root of sorted(roots)) {
      const group = groupFor(root);
      group.count++;
      walk(root, 0, group, true);
    }
  } else {
    // Manual order is depth-first (roots by position, children after their parent); the other
    // sorts rank every row on its own, with depth-first order breaking ties.
    const order: TaskRowDTO[] = [];
    const dfs = (t: TaskRowDTO) => {
      order.push(t);
      for (const k of [...(children.get(t.id) ?? [])].sort(byPosition)) dfs(k);
    };
    for (const r of [...roots].sort(byPosition)) dfs(r);
    // Positions of tasks under different parents aren't comparable, so ties keep depth-first order.
    const rank = new Map(order.map((t, i) => [t.id, i]));
    const flat = opts.sort === "manual" ? order : [...order].sort((a, b) => key(a, b) || rank.get(a.id)! - rank.get(b.id)!);
    for (const t of flat) {
      const group = groupFor(t);
      group.count++;
      group.rows.push({ task: t, indent: 0, hasChildren: false, showParent: t.parentId !== null });
    }
  }
  return [...groups.values()];
}

/** Compares by the sort key only (0 on ties); callers add their own tiebreak. */
function keyComparator(sort: SortMode): (a: TaskRowDTO, b: TaskRowDTO) => number {
  if (sort === "due") {
    return (a, b) => {
      if (a.dueDate === b.dueDate) return 0;
      if (!a.dueDate) return 1; // no date last
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    };
  }
  if (sort === "priority") return (a, b) => a.priority - b.priority;
  return () => 0;
}

const byPosition = (a: TaskRowDTO, b: TaskRowDTO) => comparePositions(a.position, b.position);

// ---------- Due dates ----------

// ---------- Re-parenting (6.4.3) ----------

/** Deepest allowed depth: 0, 1, 2 = three levels (6.4.1). Mirrors the server's MAX_DEPTH. */
export const MAX_TASK_DEPTH = 2;

/**
 * Tasks in `tasks` (a list view's Visible(L), which always holds each member's whole subtree)
 * that `taskId` may become a subtask of: not itself, not one of its descendants, not its current
 * parent, not a temporary row, and deep enough room for its subtree. The server re-checks.
 */
export function parentCandidates<T extends { id: string; parentId: string | null; depth: number }>(
  tasks: readonly T[],
  taskId: string,
): T[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return [];
  const below = new Set<string>();
  let height = 0;
  let frontier = [taskId];
  while (frontier.length > 0) {
    const next = tasks.filter((t) => t.parentId !== null && frontier.includes(t.parentId)).map((t) => t.id);
    if (next.length === 0) break;
    height += 1;
    next.forEach((id) => below.add(id));
    frontier = next;
  }
  return tasks.filter(
    (t) =>
      t.id !== taskId &&
      t.id !== task.parentId &&
      !below.has(t.id) &&
      !t.id.startsWith("temp-") &&
      t.depth + 1 + height <= MAX_TASK_DEPTH,
  );
}

export type DueTone = "overdue" | "today" | "default";

/**
 * Label and tone for a due date (9.2: red if overdue, green if today).
 * Date-only due dates are stored as UTC midnight of the chosen calendar day, so they're read
 * with UTC parts; timed ones are shown in the viewer's local time.
 */
export function formatDue(
  dueDate: string,
  dueHasTime: boolean,
  opts: { now?: Date; completed?: boolean } = {},
): { label: string; tone: DueTone } {
  const now = opts.now ?? new Date();
  const due = new Date(dueDate);
  const dueDay = dueHasTime ? localDay(due) : utcDay(due);
  const today = localDay(now);
  const diff = dayDiff(today, dueDay);

  let label: string;
  if (diff === 0) label = "Today";
  else if (diff === 1) label = "Tomorrow";
  else if (diff === -1) label = "Yesterday";
  else label = `${MONTHS[dueDay.m]} ${dueDay.d}${dueDay.y !== today.y ? `, ${dueDay.y}` : ""}`;
  if (dueHasTime) label += ` ${formatTime(due)}`;

  let tone: DueTone = "default";
  if (!opts.completed) {
    const overdue = dueHasTime ? due.getTime() < now.getTime() : diff < 0;
    tone = overdue ? "overdue" : diff === 0 ? "today" : "default";
  }
  return { label, tone };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Day = { y: number; m: number; d: number };
const localDay = (d: Date): Day => ({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
const utcDay = (d: Date): Day => ({ y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() });
/** Whole days from `a` to `b` (calendar days, DST-safe). */
const dayDiff = (a: Day, b: Day) => Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86_400_000);

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/** A date-only value for a local calendar day, stored the way the server expects (UTC midnight). */
export function dateOnlyISO(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString();
}

// ---------- Date pickers (T-14) ----------
// Storage (as formatDue reads it): a date-only value is UTC midnight of the calendar day
// (dateOnlyISO); a value with a time is the real instant, shown in local time.

/** The calendar day of `d` in local time, stored date-only. */
export function dateOnlyFromLocal(d: Date): string {
  return dateOnlyISO(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A stored value back to a local Date at 00:00 of its calendar day. */
export function localDayOf(iso: string, hasTime: boolean): Date {
  const d = new Date(iso);
  return hasTime
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
    : new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** `day` (any time) at local "HH:mm", as an instant. */
export function withLocalTime(day: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0).toISOString();
}

/** Local "HH:mm" of an instant. */
export function localTimeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Todoist-style shortcuts, as local days: Today, Tomorrow, Next week (next Monday), Next weekend (next Saturday). */
export function quickDays(now = new Date()): { label: string; day: Date }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plus = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const nextWeekday = (weekday: number) => plus(((weekday - today.getDay() + 7) % 7) || 7);
  return [
    { label: "Today", day: today },
    { label: "Tomorrow", day: plus(1) },
    { label: "Next week", day: nextWeekday(1) },
    { label: "Next weekend", day: nextWeekday(6) },
  ];
}

/** The 42 local days (6 weeks, Monday first) shown for `month` (0-based) of `year`. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

/** Same local calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---------- Avatars ----------

const AVATAR_COLORS = [
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#FDE68A", fg: "#78350F" },
  { bg: "#DCFCE7", fg: "#166534" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
  { bg: "#FFEDD5", fg: "#9A3412" },
  { bg: "#CCFBF1", fg: "#115E59" },
] as const;

/** Stable pastel pair per user id (design: blue HX, amber MR, …). */
export function avatarColors(userId: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Up to two initials: "Hussain Xaniar" → "HX", "ada" → "A". */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}
