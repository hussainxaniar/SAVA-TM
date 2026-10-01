import type { ActivityType } from "@prisma/client";
import { dateOnlyFromLocal, formatDue } from "./list-view";

/*
 * Section 6.9.5: one formatter turns an activity row into a sentence. It runs in the browser so
 * dates and times read in the viewer's time zone. The actor's name is NOT included: the feed
 * renders "<actor> <sentence>", e.g. "Ada set priority to P1".
 */

export type ActivityLike = {
  type: ActivityType;
  payload: Record<string, unknown>;
  /** id → name for the statuses, lists, users and tasks the payload mentions. */
  labels: Record<string, string>;
};

const PRIORITY = ["", "P1", "P2", "P3", "P4"];

export function formatActivity(a: ActivityLike, opts: { now?: Date } = {}): string {
  const p = a.payload;
  const label = (key: string, fallback: string) => {
    const id = p[key];
    return typeof id === "string" ? (a.labels[id] ?? fallback) : fallback;
  };
  const quote = (s: string) => `"${s.length > 60 ? `${s.slice(0, 57)}…` : s}"`;
  const day = (key: string, hasTimeKey?: string) => {
    const v = p[key];
    if (typeof v !== "string") return null;
    const hasTime = hasTimeKey ? p[hasTimeKey] === true : false;
    return formatDue(v, hasTime, { now: opts.now, completed: true }).label;
  };

  switch (a.type) {
    case "TASK_CREATED":
      return "created the task";
    case "TASK_RENAMED":
      return `renamed the task to ${quote(String(p.to ?? ""))}`;
    case "TASK_DESCRIPTION_CHANGED":
      return "updated the description";
    case "STATUS_CHANGED":
      return `changed the status from ${label("from", "another status")} to ${label("to", "another status")}`;
    case "PRIORITY_CHANGED": {
      const to = Number(p.to);
      return to >= 1 && to <= 3 ? `set priority to ${PRIORITY[to]}` : "removed the priority";
    }
    case "START_DATE_CHANGED": {
      const to = day("to");
      return to ? `set the start date to ${to}` : "removed the start date";
    }
    case "DUE_DATE_CHANGED": {
      const to = day("to", "toHasTime");
      return to ? `set the due date to ${to}` : "removed the due date";
    }
    case "ASSIGNEE_ADDED":
      return `assigned ${label("userId", "someone")}`;
    case "ASSIGNEE_REMOVED":
      return `unassigned ${label("userId", "someone")}`;
    case "MOVED_TO_LIST":
      return `moved the task from ${label("fromListId", "another list")} to ${label("toListId", "another list")}`;
    case "ADDED_TO_LIST":
      return `added the task to ${label("listId", "another list")}`;
    case "REMOVED_FROM_LIST":
      return `removed the task from ${label("listId", "another list")}`;
    case "SUBTASK_ADDED":
      return `added the subtask ${quote(label("subtaskId", "a subtask"))}`;
    case "PARENT_CHANGED":
      return p.to ? `made it a subtask of ${quote(label("to", "another task"))}` : "converted it to a task";
    case "COMMENT_ADDED":
      return "commented";
    case "SCHEDULED": {
      const start = typeof p.start === "string" ? new Date(p.start) : null;
      const end = typeof p.end === "string" ? new Date(p.end) : null;
      if (!start || !end) return "scheduled time for it";
      const onDay = formatDue(dateOnlyFromLocal(start), false, { now: opts.now, completed: true }).label;
      return `scheduled it for ${onDay} ${clock(start)}–${clock(end)}`;
    }
    case "UNSCHEDULED":
      return "removed a scheduled time";
    case "TASK_COMPLETED":
      return "completed the task";
    case "TASK_REOPENED":
      return "reopened the task";
    case "TASK_DELETED":
      return "deleted the task";
    case "TASK_RESTORED":
      return "restored the task";
  }
}

/** "just now", "5m ago", "2h ago", "yesterday", "3d ago", then "Sep 28" (with the year if it differs). */
export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) /
      86_400_000,
  );
  if (days <= 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const month = then.toLocaleString("en-US", { month: "short" });
  return then.getFullYear() === now.getFullYear() ? `${month} ${then.getDate()}` : `${month} ${then.getDate()}, ${then.getFullYear()}`;
}

/** Local "10:45". */
function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
