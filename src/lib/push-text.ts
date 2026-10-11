/*
 * The words of a web push (Section 17): title = who, body = what, e.g. "Ada Lovelace" /
 * "assigned you to Write the brief". Built on the server, which does not know the reader's time
 * zone: a date-only due date reads as its calendar day ("Oct 12"); a due date with a time is
 * left out of the sentence (the bell shows it in local time).
 */

export type PushTextInput = {
  type: "ASSIGNED" | "COMMENTED" | "STATUS_CHANGED" | "DUE_DATE_CHANGED";
  actorName: string;
  taskTitle: string;
  statusName: string | null;
  completed: boolean | null;
  /** ISO; date-only values are UTC midnight of the day. */
  dueDate: string | null;
  dueHasTime: boolean;
  /** DUE_DATE_CHANGED only: true when the due date was removed. */
  dueCleared: boolean;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_TITLE = 120;

export function pushText(n: PushTextInput): { title: string; body: string } {
  const task = n.taskTitle.length > MAX_TITLE ? `${n.taskTitle.slice(0, MAX_TITLE - 1)}…` : n.taskTitle;
  return { title: n.actorName, body: sentence(n, task) };
}

function sentence(n: PushTextInput, task: string): string {
  switch (n.type) {
    case "ASSIGNED":
      return `assigned you to ${task}`;
    case "COMMENTED":
      return `commented on ${task}`;
    case "STATUS_CHANGED":
      if (n.completed === true) return `completed ${task}`;
      if (n.completed === false) return `reopened ${task}`;
      return `changed the status of ${task}${n.statusName ? ` to ${n.statusName}` : ""}`;
    case "DUE_DATE_CHANGED": {
      if (n.dueCleared) return `removed the due date of ${task}`;
      if (!n.dueDate || n.dueHasTime) return `changed the due date of ${task}`;
      const d = new Date(n.dueDate);
      return `changed the due date of ${task} to ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
    }
  }
}
