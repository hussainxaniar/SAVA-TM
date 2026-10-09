import type { NotificationDTO } from "@/server/services/types";
import { formatDue } from "./list-view";

/*
 * Section 16.4. A notification reads "<actor> <before> <task title><after>", e.g.
 * "Ada commented on Write the brief" or "Ben changed the status of Write the brief to Review".
 * It runs in the browser so a due date reads in the viewer's time zone.
 */

export function notificationParts(n: NotificationDTO, opts: { now?: Date } = {}): { before: string; after: string } {
  switch (n.type) {
    case "ASSIGNED":
      return { before: "assigned you to", after: "" };
    case "COMMENTED":
      return { before: "commented on", after: "" };
    case "STATUS_CHANGED":
      if (n.completed === true) return { before: "completed", after: "" };
      if (n.completed === false) return { before: "reopened", after: "" };
      return { before: "changed the status of", after: n.statusName ? ` to ${n.statusName}` : "" };
    case "DUE_DATE_CHANGED":
      if (!n.dueDate) return { before: "removed the due date of", after: "" };
      return {
        before: "changed the due date of",
        after: ` to ${formatDue(n.dueDate, n.dueHasTime, { now: opts.now, completed: true }).label}`,
      };
  }
}

/** Where a notification leads: the task's home list with its dialog open (`?task=`). */
export function notificationHref(spaceId: string, n: Pick<NotificationDTO, "task">): string {
  return `/s/${spaceId}/p/${n.task.projectId}/l/${n.task.homeListId}?task=${n.task.id}`;
}
