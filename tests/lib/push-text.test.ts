import { describe, expect, it } from "vitest";
import { pushText, type PushTextInput } from "@/lib/push-text";

const base: PushTextInput = {
  type: "ASSIGNED",
  actorName: "Ada Lovelace",
  taskTitle: "Write the brief",
  statusName: null,
  completed: null,
  dueDate: null,
  dueHasTime: false,
  dueCleared: false,
};

describe("pushText", () => {
  it("names the actor in the title and the event in the body", () => {
    expect(pushText(base)).toEqual({ title: "Ada Lovelace", body: "assigned you to Write the brief" });
    expect(pushText({ ...base, type: "COMMENTED" }).body).toBe("commented on Write the brief");
  });
  it("words status changes like the bell", () => {
    expect(pushText({ ...base, type: "STATUS_CHANGED", statusName: "Review" }).body).toBe("changed the status of Write the brief to Review");
    expect(pushText({ ...base, type: "STATUS_CHANGED", completed: true }).body).toBe("completed Write the brief");
    expect(pushText({ ...base, type: "STATUS_CHANGED", completed: false }).body).toBe("reopened Write the brief");
    expect(pushText({ ...base, type: "STATUS_CHANGED" }).body).toBe("changed the status of Write the brief");
  });
  it("shows a date-only due date as its calendar day and leaves a timed one out", () => {
    const due = { ...base, type: "DUE_DATE_CHANGED" as const };
    expect(pushText({ ...due, dueDate: "2026-10-12T00:00:00.000Z" }).body).toBe("changed the due date of Write the brief to Oct 12");
    expect(pushText({ ...due, dueDate: "2026-10-12T21:30:00.000Z", dueHasTime: true }).body).toBe("changed the due date of Write the brief");
    expect(pushText({ ...due, dueCleared: true }).body).toBe("removed the due date of Write the brief");
  });
  it("shortens a very long task title", () => {
    const body = pushText({ ...base, taskTitle: "x".repeat(300) }).body;
    expect(body.length).toBeLessThan(140);
    expect(body.endsWith("…")).toBe(true);
  });
});
