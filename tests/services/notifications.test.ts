import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addComment } from "@/server/services/comments";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/services/notifications";
import { createProject } from "@/server/services/projects";
import { createTask, deleteTask, setAssignees, setCompleted, updateTask } from "@/server/services/tasks";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

let s: Awaited<ReturnType<typeof makeSpace<"owner" | "ada" | "ben" | "cy">>>;
let ada: { userId: string }; // creates tasks
let ben: { userId: string }; // assignee
let cy: { userId: string }; // uninvolved member
let listId: string;
let spaceId: string;
let statuses: { todo: string; active: string; done: string };

const types = async (userId: string) =>
  (await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })).map((n) => n.type);

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", ada: "MEMBER", ben: "MEMBER", cy: "MEMBER" });
  spaceId = s.space.id;
  ada = as(s.users.ada.id);
  ben = as(s.users.ben.id);
  cy = as(s.users.cy.id);
  const p = await createProject(as(s.users.owner.id), { spaceId, name: "P" });
  listId = p.firstListId;
  const rows = await db.status.findMany({ where: { projectId: p.projectId } });
  const by = (c: string) => rows.find((x) => x.category === c)!.id;
  statuses = { todo: by("TODO"), active: by("ACTIVE"), done: by("DONE") };
});

describe("who is notified", () => {
  it("notifies a new assignee, but not the person who assigned them", async () => {
    const t = await createTask(ada, { listId, title: "T" });
    await setAssignees(ada, { taskId: t.id, userIds: [ben.userId] });
    expect(await types(ben.userId)).toEqual(["ASSIGNED"]);
    expect(await types(ada.userId)).toEqual([]);
    // creating a task already assigned to someone else notifies them too
    await createTask(ada, { listId, title: "U", assigneeIds: [ben.userId] });
    expect(await types(ben.userId)).toEqual(["ASSIGNED", "ASSIGNED"]);
  });

  it("never notifies someone of their own action", async () => {
    const t = await createTask(ada, { listId, title: "T", assigneeIds: [ada.userId] });
    await addComment(ada, { taskId: t.id, body: doc("note to self") });
    await updateTask(ada, { taskId: t.id, statusId: statuses.active });
    expect(await types(ada.userId)).toEqual([]);
  });

  it("sends comments to the assignees and the creator, once each, and not to uninvolved members", async () => {
    const t = await createTask(ada, { listId, title: "T", assigneeIds: [ben.userId, ada.userId] });
    await addComment(cy, { taskId: t.id, body: doc("hello") });
    expect(await types(ada.userId)).toEqual(["COMMENTED"]); // creator and assignee, but one notification
    expect(await types(ben.userId)).toEqual(["ASSIGNED", "COMMENTED"]);
    expect(await types(cy.userId)).toEqual([]);
  });

  it("sends status and due-date changes to the people involved", async () => {
    const t = await createTask(ada, { listId, title: "T", assigneeIds: [ben.userId] });
    await updateTask(cy, { taskId: t.id, statusId: statuses.active });
    await updateTask(cy, { taskId: t.id, dueDate: "2026-11-02" });
    expect(await types(ben.userId)).toEqual(["ASSIGNED", "STATUS_CHANGED", "DUE_DATE_CHANGED"]);
    expect(await types(ada.userId)).toEqual(["STATUS_CHANGED", "DUE_DATE_CHANGED"]);

    const list = await listNotifications(ben, { spaceId });
    expect(list.map((n) => n.type)).toEqual(["DUE_DATE_CHANGED", "STATUS_CHANGED", "ASSIGNED"]);
    expect(list[0]).toMatchObject({ dueDate: expect.stringContaining("2026-11-02"), actor: { id: cy.userId } });
    expect(list[1]).toMatchObject({ statusName: expect.any(String), completed: null });
  });

  it("writes one status notification per edit, for choosing a status and for complete / reopen", async () => {
    const t = await createTask(ada, { listId, title: "T", assigneeIds: [ben.userId] });
    await updateTask(cy, { taskId: t.id, statusId: statuses.done });
    const forBen = () => db.notification.findMany({ where: { userId: ben.userId, type: "STATUS_CHANGED" }, orderBy: { createdAt: "asc" } });
    expect((await forBen()).map((n) => n.payload)).toEqual([{ to: statuses.done }]);

    await setCompleted(cy, { taskId: t.id, completed: false });
    expect((await forBen()).map((n) => n.payload)).toEqual([{ to: statuses.done }, { completed: false }]);
    await setCompleted(cy, { taskId: t.id, completed: true });
    expect((await forBen()).at(-1)?.payload).toEqual({ completed: true });
  });

  it("does not notify people who left the space, and rolls back with a failed mutation", async () => {
    const t = await createTask(ada, { listId, title: "T", assigneeIds: [ben.userId] });
    await db.spaceMember.delete({ where: { spaceId_userId: { spaceId, userId: ben.userId } } });
    const before = await db.notification.count({ where: { userId: ben.userId } });
    await addComment(cy, { taskId: t.id, body: doc("anyone there?") });
    expect(await db.notification.count({ where: { userId: ben.userId } })).toBe(before);

    // an invalid edit throws inside its transaction: nothing is left behind for the creator
    await expect(updateTask(cy, { taskId: t.id, statusId: "not-a-status" })).rejects.toThrow();
    expect(await types(ada.userId)).toEqual(["COMMENTED"]);
  });
});

describe("reading and marking", () => {
  let taskId: string;
  beforeEach(async () => {
    taskId = (await createTask(ada, { listId, title: "Write the brief", assigneeIds: [ben.userId] })).id;
    await addComment(cy, { taskId, body: doc("one") });
    await addComment(cy, { taskId, body: doc("two") });
  });

  it("lists newest first with the task and actor, counts unread and respects limit and unreadOnly", async () => {
    const list = await listNotifications(ben, { spaceId });
    expect(list.map((n) => n.type)).toEqual(["COMMENTED", "COMMENTED", "ASSIGNED"]);
    expect(list[0]).toMatchObject({ task: { id: taskId, title: "Write the brief" }, actor: { id: cy.userId }, readAt: null });
    expect(await getUnreadCount(ben, { spaceId })).toBe(3);
    expect(await listNotifications(ben, { spaceId, limit: 1 })).toHaveLength(1);

    await markNotificationRead(ben, { notificationId: list[0].id });
    expect(await getUnreadCount(ben, { spaceId })).toBe(2);
    expect(await listNotifications(ben, { spaceId, unreadOnly: true })).toHaveLength(2);
  });

  it("marks everything read in one space only for the caller", async () => {
    await markAllNotificationsRead(ben, { spaceId });
    expect(await getUnreadCount(ben, { spaceId })).toBe(0);
    expect(await getUnreadCount(ada, { spaceId })).toBe(2); // ada created the task: two comments, still unread
  });

  it("keeps notifications private and hides those of deleted tasks", async () => {
    const [n] = await listNotifications(ben, { spaceId });
    await expect(markNotificationRead(cy, { notificationId: n.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const outsider = await makeUser("outsider-notify");
    await expect(listNotifications(as(outsider.id), { spaceId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getUnreadCount(as(outsider.id), { spaceId })).rejects.toMatchObject({ code: "NOT_FOUND" });

    await deleteTask(ada, { taskId });
    expect(await listNotifications(ben, { spaceId })).toEqual([]);
    expect(await getUnreadCount(ben, { spaceId })).toBe(0);
  });
});
