import { describe, expect, it } from "vitest";
import { notificationHref, notificationParts } from "@/lib/notification-format";
import type { NotificationDTO } from "@/server/services/types";

const base: NotificationDTO = {
  id: "n1",
  type: "ASSIGNED",
  createdAt: "2026-10-09T10:00:00.000Z",
  readAt: null,
  actor: { id: "u1", name: "Ada", image: null },
  task: { id: "t1", title: "Write the brief", projectId: "p1", homeListId: "l1" },
  statusName: null,
  completed: null,
  dueDate: null,
  dueHasTime: false,
};
const n = (over: Partial<NotificationDTO>): NotificationDTO => ({ ...base, ...over });
const now = new Date("2026-10-09T12:00:00");

describe("notificationParts", () => {
  it("words assignment and comments", () => {
    expect(notificationParts(n({}))).toEqual({ before: "assigned you to", after: "" });
    expect(notificationParts(n({ type: "COMMENTED" }))).toEqual({ before: "commented on", after: "" });
  });

  it("words status changes, completion and reopening", () => {
    expect(notificationParts(n({ type: "STATUS_CHANGED", statusName: "Review" }))).toEqual({ before: "changed the status of", after: " to Review" });
    expect(notificationParts(n({ type: "STATUS_CHANGED", statusName: null }))).toEqual({ before: "changed the status of", after: "" });
    expect(notificationParts(n({ type: "STATUS_CHANGED", completed: true }))).toEqual({ before: "completed", after: "" });
    expect(notificationParts(n({ type: "STATUS_CHANGED", completed: false }))).toEqual({ before: "reopened", after: "" });
  });

  it("words a changed or removed due date", () => {
    expect(notificationParts(n({ type: "DUE_DATE_CHANGED", dueDate: null }))).toEqual({ before: "removed the due date of", after: "" });
    const parts = notificationParts(n({ type: "DUE_DATE_CHANGED", dueDate: "2026-10-10T00:00:00.000Z" }), { now });
    expect(parts.before).toBe("changed the due date of");
    expect(parts.after).toMatch(/^ to \S/);
  });
});

describe("notificationHref", () => {
  it("opens the task in its home list", () => {
    expect(notificationHref("s1", base)).toBe("/s/s1/p/p1/l/l1?task=t1");
  });
});
