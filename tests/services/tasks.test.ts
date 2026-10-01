import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { comparePositions } from "@/lib/position";
import { db } from "@/server/db";
import { createList } from "@/server/services/lists";
import { createProject } from "@/server/services/projects";
import { createStatus } from "@/server/services/statuses";
import {
  addTaskToList,
  createTask,
  deleteTask,
  getListView,
  getMyTasks,
  getTask,
  moveTask,
  removeTaskFromList,
  reorderTask,
  restoreTask,
  setAssignees,
  setCompleted,
  setParent,
  updateTask,
} from "@/server/services/tasks";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "member" | "other">>>;
let me: { userId: string };
let projectId: string;
let general: string;
let other: string;
let st: Record<"todo" | "active" | "done", string>;

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", member: "MEMBER", other: "MEMBER" });
  me = as(s.users.member.id);
  ({ projectId, firstListId: general } = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" }));
  other = (await createList(me, { projectId, name: "Other" })).listId;
  const statuses = await db.status.findMany({ where: { projectId } });
  const by = (c: string) => statuses.find((x) => x.category === c)!.id;
  st = { todo: by("TODO"), active: by("ACTIVE"), done: by("DONE") };
});

const activity = (taskId: string) =>
  db.activity.findMany({ where: { taskId }, orderBy: { createdAt: "asc" }, select: { type: true, payload: true, actorId: true } });
const types = async (taskId: string) => (await activity(taskId)).map((a) => a.type);
const view = async (listId: string) => (await getListView(me, { listId })).tasks;
const titles = async (listId: string) => (await view(listId)).map((t) => t.title);
const link = (taskId: string, listId: string, position: string) =>
  db.taskListLink.create({ data: { taskId, listId, position, addedById: s.users.owner.id } });

describe("createTask", () => {
  it("creates a top-level task at the end with defaults and TASK_CREATED", async () => {
    const a = await createTask(me, { listId: general, title: " First " });
    const b = await createTask(me, { listId: general, title: "Second" });
    expect(a).toMatchObject({
      title: "First",
      priority: 4,
      status: { id: st.todo, category: "TODO" },
      depth: 0,
      parentId: null,
      homeListId: general,
      isLinkedHere: false,
      completedAt: null,
      subtaskCount: 0,
    });
    expect(await titles(general)).toEqual(["First", "Second"]);
    expect(await activity(b.id)).toEqual([{ type: "TASK_CREATED", payload: {}, actorId: me.userId }]);
  });

  it("inserts after a given task", async () => {
    const a = await createTask(me, { listId: general, title: "A" });
    await createTask(me, { listId: general, title: "C" });
    await createTask(me, { listId: general, title: "B", afterTaskId: a.id });
    expect(await titles(general)).toEqual(["A", "B", "C"]);
  });

  it("creates subtasks that inherit placement, up to three levels, logging SUBTASK_ADDED", async () => {
    const parent = await createTask(me, { listId: general, title: "Parent" });
    // listId is ignored when a parent is given: the subtask lives in the parent's home list.
    const child = await createTask(me, { listId: other, parentId: parent.id, title: "Child" });
    const grandchild = await createTask(me, { listId: general, parentId: child.id, title: "Grandchild" });
    expect(child).toMatchObject({ parentId: parent.id, parentTitle: "Parent", depth: 1, homeListId: general });
    expect(grandchild).toMatchObject({ depth: 2, homeListId: general });
    await expect(createTask(me, { listId: general, parentId: grandchild.id, title: "Too deep" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await activity(parent.id)).toEqual([
      { type: "TASK_CREATED", payload: {}, actorId: me.userId },
      { type: "SUBTASK_ADDED", payload: { subtaskId: child.id }, actorId: me.userId },
    ]);
  });

  it("takes all fields, assigns members only, and completes when created into DONE", async () => {
    const t = await createTask(me, {
      listId: general,
      title: "Full",
      priority: 1,
      statusId: st.done,
      startDate: "2026-10-01T00:00:00.000Z",
      dueDate: "2026-10-03T15:00:00.000Z",
      dueHasTime: true,
      assigneeIds: [s.users.owner.id, s.users.owner.id],
      description: { type: "doc", content: [] },
    });
    expect(t).toMatchObject({
      priority: 1,
      status: { id: st.done },
      startDate: "2026-10-01T00:00:00.000Z",
      dueDate: "2026-10-03T15:00:00.000Z",
      dueHasTime: true,
      assignees: [{ id: s.users.owner.id, name: "owner", image: null }],
    });
    expect(t.completedAt).not.toBeNull();
    expect(await types(t.id)).toEqual(["TASK_CREATED", "ASSIGNEE_ADDED", "TASK_COMPLETED"]);

    const outsider = await makeUser();
    await expect(createTask(me, { listId: general, title: "X", assigneeIds: [outsider.id] })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("rejects bad input, foreign statuses, archived lists and non-members", async () => {
    const q = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Q" });
    const foreignStatus = await db.status.findFirstOrThrow({ where: { projectId: q.projectId } });
    await expect(createTask(me, { listId: general, title: "  " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createTask(me, { listId: general, title: "X", priority: 5 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createTask(me, { listId: general, title: "X", dueDate: "nope" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createTask(me, { listId: general, title: "X", statusId: foreignStatus.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await db.list.update({ where: { id: other }, data: { archivedAt: new Date() } });
    await expect(createTask(me, { listId: other, title: "X" })).rejects.toMatchObject({ code: "VALIDATION" });
    const outsider = await makeUser();
    await expect(createTask(as(outsider.id), { listId: general, title: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateTask", () => {
  it("logs one row per changed field with the right payloads", async () => {
    const t = await createTask(me, { listId: general, title: "Old", dueDate: "2026-10-01T00:00:00.000Z" });
    await updateTask(me, {
      taskId: t.id,
      title: "New",
      priority: 2,
      statusId: st.active,
      startDate: "2026-09-30T00:00:00.000Z",
      dueDate: "2026-10-02T09:00:00.000Z",
      dueHasTime: true,
    });
    const rows = (await activity(t.id)).slice(1);
    expect(rows).toEqual([
      { type: "TASK_RENAMED", payload: { from: "Old", to: "New" }, actorId: me.userId },
      { type: "PRIORITY_CHANGED", payload: { from: 4, to: 2 }, actorId: me.userId },
      { type: "STATUS_CHANGED", payload: { from: st.todo, to: st.active }, actorId: me.userId },
      { type: "START_DATE_CHANGED", payload: { from: null, to: "2026-09-30T00:00:00.000Z" }, actorId: me.userId },
      {
        type: "DUE_DATE_CHANGED",
        payload: { from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T09:00:00.000Z", fromHasTime: false, toHasTime: true },
        actorId: me.userId,
      },
    ]);
    // Same values again: nothing changes, nothing is logged.
    const again = await updateTask(me, { taskId: t.id, title: "New", priority: 2, statusId: st.active });
    expect(again).toMatchObject({ title: "New", priority: 2, dueHasTime: true });
    expect((await activity(t.id)).length).toBe(6);
    // Clearing the due date also clears dueHasTime.
    const cleared = await updateTask(me, { taskId: t.id, dueDate: null });
    expect(cleared).toMatchObject({ dueDate: null, dueHasTime: false });
  });

  it("sets completedAt when the status moves into DONE and clears it when it leaves", async () => {
    const t = await createTask(me, { listId: general, title: "T" });
    expect((await updateTask(me, { taskId: t.id, statusId: st.done })).completedAt).not.toBeNull();
    expect((await updateTask(me, { taskId: t.id, statusId: st.active })).completedAt).toBeNull();
    await expect(updateTask(me, { taskId: t.id, statusId: "nope" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("coalesces description edits by the same person within 10 minutes", async () => {
    const t = await createTask(me, { listId: general, title: "T" });
    const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
    await updateTask(me, { taskId: t.id, description: doc("a") });
    await updateTask(me, { taskId: t.id, description: doc("ab") });
    expect((await types(t.id)).filter((x) => x === "TASK_DESCRIPTION_CHANGED")).toHaveLength(1);
    // Someone else editing is logged separately.
    await updateTask(as(s.users.owner.id), { taskId: t.id, description: doc("abc") });
    // Age my earlier row past the window: my next edit is logged again.
    await db.activity.updateMany({
      where: { taskId: t.id, type: "TASK_DESCRIPTION_CHANGED", actorId: me.userId },
      data: { createdAt: new Date(Date.now() - 11 * 60 * 1000) },
    });
    await updateTask(me, { taskId: t.id, description: null });
    expect((await types(t.id)).filter((x) => x === "TASK_DESCRIPTION_CHANGED")).toHaveLength(3);
    expect((await getTask(me, { taskId: t.id })).description).toBeNull();
  });
});

describe("updateTask status into DONE with completeSubtasks", () => {
  it("moves open descendants to the chosen DONE status, each logging TASK_COMPLETED", async () => {
    const shipped = await createStatus(as(s.users.owner.id), { projectId, name: "Shipped", color: "#16A34A", category: "DONE" });
    const parent = await createTask(me, { listId: general, title: "Parent" });
    const a = await createTask(me, { listId: general, parentId: parent.id, title: "A" });
    const b = await createTask(me, { listId: general, parentId: a.id, title: "B" });
    const alreadyDone = await createTask(me, { listId: general, parentId: parent.id, title: "Done already", statusId: st.done });

    await updateTask(me, { taskId: parent.id, statusId: shipped.id, completeSubtasks: true });
    for (const id of [a.id, b.id]) {
      const t = await getTask(me, { taskId: id });
      expect(t.status.id).toBe(shipped.id);
      expect(t.completedAt).not.toBeNull();
      expect((await types(id)).filter((x) => x === "TASK_COMPLETED")).toHaveLength(1);
    }
    expect((await getTask(me, { taskId: alreadyDone.id })).status.id).toBe(st.done); // untouched
    expect(await types(parent.id)).toContain("STATUS_CHANGED");
  });

  it("ignores completeSubtasks when the status isn't moving into DONE", async () => {
    const parent = await createTask(me, { listId: general, title: "Parent" });
    const child = await createTask(me, { listId: general, parentId: parent.id, title: "Child" });
    await updateTask(me, { taskId: parent.id, statusId: st.active, completeSubtasks: true });
    expect((await getTask(me, { taskId: child.id })).completedAt).toBeNull();
  });
});

describe("setCompleted", () => {
  it("completes into the first DONE status and reopens into the first TODO status", async () => {
    const shipped = await createStatus(as(s.users.owner.id), { projectId, name: "Shipped", color: "#16A34A", category: "DONE" });
    await db.status.update({ where: { id: shipped.id }, data: { position: "0" } }); // now the first DONE
    const t = await createTask(me, { listId: general, title: "T", statusId: st.active });

    await setCompleted(me, { taskId: t.id, completed: true });
    let row = (await view(general)).find((x) => x.id === t.id)!;
    expect(row.status.id).toBe(shipped.id);
    expect(row.completedAt).not.toBeNull();

    await setCompleted(me, { taskId: t.id, completed: true }); // already done: no second row
    await setCompleted(me, { taskId: t.id, completed: false });
    row = (await view(general)).find((x) => x.id === t.id)!;
    expect(row).toMatchObject({ status: { id: st.todo }, completedAt: null });
    expect(await types(t.id)).toEqual(["TASK_CREATED", "TASK_COMPLETED", "TASK_REOPENED"]);
  });

  it("completes open subtasks only when asked", async () => {
    const parent = await createTask(me, { listId: general, title: "Parent" });
    const a = await createTask(me, { listId: general, parentId: parent.id, title: "A" });
    const b = await createTask(me, { listId: general, parentId: a.id, title: "B" });

    await setCompleted(me, { taskId: parent.id, completed: true });
    expect((await getTask(me, { taskId: a.id })).completedAt).toBeNull();
    await setCompleted(me, { taskId: parent.id, completed: false });

    await setCompleted(me, { taskId: parent.id, completed: true, includeSubtasks: true });
    for (const id of [parent.id, a.id, b.id]) {
      expect((await getTask(me, { taskId: id })).completedAt).not.toBeNull();
    }
    expect(await types(b.id)).toEqual(["TASK_CREATED", "TASK_COMPLETED"]);
    expect((await getTask(me, { taskId: parent.id })).openSubtaskCount).toBe(0);
  });
});

describe("setAssignees", () => {
  it("diffs the set, logging each addition and removal; members only", async () => {
    const t = await createTask(me, { listId: general, title: "T", assigneeIds: [s.users.owner.id] });
    await setAssignees(me, { taskId: t.id, userIds: [s.users.member.id, s.users.other.id] });
    const rows = (await activity(t.id)).filter((x) => x.type.startsWith("ASSIGNEE"));
    expect(rows.map((x) => [x.type, x.payload])).toEqual([
      ["ASSIGNEE_ADDED", { userId: s.users.owner.id }],
      ["ASSIGNEE_ADDED", { userId: s.users.member.id }],
      ["ASSIGNEE_ADDED", { userId: s.users.other.id }],
      ["ASSIGNEE_REMOVED", { userId: s.users.owner.id }],
    ]);
    const outsider = await makeUser();
    await expect(setAssignees(me, { taskId: t.id, userIds: [outsider.id] })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("getListView (6.7)", () => {
  it("shows home tasks with their subtrees, linked tasks with theirs, and linked subtasks as roots", async () => {
    const home = await createTask(me, { listId: general, title: "Home" });
    await createTask(me, { listId: general, parentId: home.id, title: "Home child" });
    await createTask(me, { listId: general, title: "Done one", statusId: st.done });
    const gone = await createTask(me, { listId: general, title: "Deleted" });
    await deleteTask(me, { taskId: gone.id });

    // Lives in Other; linked into General together with its subtree.
    const visitor = await createTask(me, { listId: other, title: "Visitor" });
    const visitorChild = await createTask(me, { listId: other, parentId: visitor.id, title: "Visitor child" });
    await createTask(me, { listId: other, parentId: visitorChild.id, title: "Visitor grandchild" });
    await link(visitor.id, general, "zz");

    // A subtask in Other, linked into General on its own: its parent stays out.
    const outside = await createTask(me, { listId: other, title: "Outside parent" });
    const linkedSub = await createTask(me, { listId: other, parentId: outside.id, title: "Linked subtask" });
    await link(linkedSub.id, general, "zy");

    const rows = await view(general);
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
    expect(Object.keys(byTitle).sort()).toEqual(
      ["Done one", "Home", "Home child", "Linked subtask", "Visitor", "Visitor child", "Visitor grandchild"].sort(),
    );
    expect(byTitle["Visitor"]).toMatchObject({ isLinkedHere: true, position: "zz", homeListId: other, subtaskCount: 1 });
    expect(byTitle["Visitor child"]).toMatchObject({ isLinkedHere: false, parentId: visitor.id });
    expect(byTitle["Visitor grandchild"].parentId).toBe(visitorChild.id);
    expect(byTitle["Linked subtask"]).toMatchObject({
      isLinkedHere: true,
      parentId: outside.id,
      parentTitle: "Outside parent",
      position: "zy",
    });
    expect(byTitle["Home child"]).toMatchObject({ parentId: home.id, isLinkedHere: false });
    expect(byTitle["Done one"].completedAt).not.toBeNull();
    expect(byTitle["Home"]).toMatchObject({ subtaskCount: 1, openSubtaskCount: 1 });

    // Other shows its own tasks; nothing from General leaks in.
    expect((await titles(other)).sort()).toEqual(
      ["Linked subtask", "Outside parent", "Visitor", "Visitor child", "Visitor grandchild"].sort(),
    );
    expect(await view(other)).toEqual(expect.not.arrayContaining([expect.objectContaining({ isLinkedHere: true })]));

    const listView = await getListView(me, { listId: general });
    expect(listView.list).toMatchObject({ id: general, name: "General", subtaskDisplay: "NESTED", projectId });
    expect(listView.statuses.map((x) => x.id)).toEqual([st.todo, st.active, st.done]);
  });

  it("counts live comments and hides the list from non-members", async () => {
    const t = await createTask(me, { listId: general, title: "T" });
    await db.comment.createMany({
      data: [
        { taskId: t.id, authorId: me.userId, body: {}, bodyText: "a" },
        { taskId: t.id, authorId: me.userId, body: {}, bodyText: "b", deletedAt: new Date() },
      ],
    });
    expect((await view(general))[0].commentCount).toBe(1);
    const outsider = await makeUser();
    await expect(getListView(as(outsider.id), { listId: general })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("reorderTask", () => {
  it("orders roots across home and linked tasks, and subtasks among siblings", async () => {
    const a = await createTask(me, { listId: general, title: "A" });
    const b = await createTask(me, { listId: general, title: "B" });
    const v = await createTask(me, { listId: other, title: "V" });
    await link(v.id, general, "zz"); // shown last in General

    await reorderTask(me, { taskId: v.id, listId: general, afterId: a.id }); // move the link to the top
    expect(await titles(general)).toEqual(["V", "A", "B"]);
    expect((await db.task.findUniqueOrThrow({ where: { id: v.id } })).position).not.toBe("zz"); // home order untouched…
    await reorderTask(me, { taskId: a.id, listId: general, beforeId: b.id }); // …home task below B
    expect(await titles(general)).toEqual(["V", "B", "A"]);

    const c1 = await createTask(me, { listId: general, parentId: b.id, title: "c1" });
    const c2 = await createTask(me, { listId: general, parentId: b.id, title: "c2" });
    await reorderTask(me, { taskId: c2.id, listId: general, afterId: c1.id });
    expect((await getTask(me, { taskId: b.id })).subtasks.map((x) => x.title)).toEqual(["c2", "c1"]);

    await expect(reorderTask(me, { taskId: a.id, listId: other })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(reorderTask(me, { taskId: c1.id, listId: general, afterId: a.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("deleteTask / restoreTask", () => {
  it("soft-deletes a subtree and restores what was deleted with it", async () => {
    const parent = await createTask(me, { listId: general, title: "Parent" });
    const child = await createTask(me, { listId: general, parentId: parent.id, title: "Child" });
    const earlier = await createTask(me, { listId: general, parentId: parent.id, title: "Deleted earlier" });
    await deleteTask(me, { taskId: earlier.id });

    await deleteTask(me, { taskId: parent.id });
    expect(await titles(general)).toEqual([]);
    await expect(getTask(me, { taskId: child.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(restoreTask(me, { taskId: child.id })).rejects.toMatchObject({ code: "VALIDATION" });

    await restoreTask(me, { taskId: parent.id });
    expect((await titles(general)).sort()).toEqual(["Child", "Parent"]);
    expect(await types(parent.id)).toEqual(["TASK_CREATED", "SUBTASK_ADDED", "SUBTASK_ADDED", "TASK_DELETED", "TASK_RESTORED"]);
    await restoreTask(me, { taskId: parent.id }); // already live: no-op
    await expect(deleteTask(me, { taskId: earlier.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getTask", () => {
  it("returns the panel detail: breadcrumb, lists, subtasks, creator", async () => {
    const root = await createTask(me, { listId: general, title: "Root" });
    const mid = await createTask(me, { listId: general, parentId: root.id, title: "Mid" });
    const leaf = await createTask(me, { listId: general, parentId: mid.id, title: "Leaf" });
    await link(leaf.id, other, "a0");
    await createTask(me, { listId: general, parentId: mid.id, title: "Sibling" });

    const detail = await getTask(me, { taskId: leaf.id });
    expect(detail).toMatchObject({
      title: "Leaf",
      projectId,
      spaceId: s.space.id,
      homeList: { id: general, name: "General" },
      linkedLists: [{ id: other, name: "Other" }],
      breadcrumb: [
        { id: root.id, title: "Root" },
        { id: mid.id, title: "Mid" },
      ],
      subtasks: [],
      createdBy: { id: me.userId, name: "member" },
    });
    expect((await getTask(me, { taskId: mid.id })).subtasks.map((x) => x.title)).toEqual(["Leaf", "Sibling"]);
    const outsider = await makeUser();
    await expect(getTask(as(outsider.id), { taskId: leaf.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getMyTasks", () => {
  it("returns my open, live tasks in this space with where they live", async () => {
    const mine = await createTask(me, { listId: general, title: "Mine", assigneeIds: [me.userId] });
    await createTask(me, { listId: general, title: "Theirs", assigneeIds: [s.users.owner.id] });
    await createTask(me, { listId: general, title: "Done", assigneeIds: [me.userId], statusId: st.done });
    const gone = await createTask(me, { listId: general, title: "Deleted", assigneeIds: [me.userId] });
    await deleteTask(me, { taskId: gone.id });
    const q = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Archived" });
    await createTask(me, { listId: q.firstListId, title: "In archived project", assigneeIds: [me.userId] });
    await db.project.update({ where: { id: q.projectId }, data: { archivedAt: new Date() } });

    const rows = await getMyTasks(me, { spaceId: s.space.id });
    expect(rows).toEqual([
      expect.objectContaining({ id: mine.id, projectId, projectName: "P", projectColor: "#64748B", listName: "General" }),
    ]);
  });
});

describe("sidebar open counts and list view project", () => {
  it("counts open, live tasks per list, linked ones included", async () => {
    const { getSidebar } = await import("@/server/services/projects");
    const parent = await createTask(me, { listId: general, title: "Open" });
    await createTask(me, { listId: general, parentId: parent.id, title: "Open child" });
    await createTask(me, { listId: general, title: "Done", statusId: st.done });
    const gone = await createTask(me, { listId: general, title: "Deleted" });
    await deleteTask(me, { taskId: gone.id });
    const visitor = await createTask(me, { listId: other, title: "Visitor" });
    await link(visitor.id, general, "zz");

    const lists = (await getSidebar(me, { spaceId: s.space.id })).projects.find((p) => p.id === projectId)!.lists;
    expect(Object.fromEntries(lists.map((l) => [l.name, l.openTaskCount]))).toEqual({ General: 3, Other: 1 });
    expect((await getListView(me, { listId: general })).project).toEqual({
      id: projectId,
      spaceId: s.space.id,
      name: "P",
      color: "#64748B",
      lists: [
        { id: general, name: "General" },
        { id: other, name: "Other" },
      ],
    });
  });
});

describe("getTask dialog context", () => {
  it("returns the project and its statuses in position order", async () => {
    const t = await createTask(me, { listId: general, title: "T" });
    const extra = await createStatus(as(s.users.owner.id), { projectId, name: "Review", color: "#F59E0B", category: "ACTIVE" });
    const detail = await getTask(me, { taskId: t.id });
    expect(detail.project).toEqual({
      id: projectId,
      name: "P",
      color: expect.any(String),
      lists: [
        { id: general, name: "General" },
        { id: other, name: "Other" },
      ],
    });
    const ordered = await db.status.findMany({ where: { projectId }, orderBy: { position: "asc" }, select: { id: true } });
    expect(detail.statuses.map((x) => x.id)).toEqual(ordered.map((x) => x.id));
    expect(detail.statuses.map((x) => x.id)).toContain(extra.id);
  });
});

describe("setParent", () => {
  const row = (id: string) =>
    db.task.findUniqueOrThrow({ where: { id }, select: { parentId: true, depth: true, homeListId: true } });

  it("makes a task a subtask (last among siblings) and promotes it back, logging PARENT_CHANGED", async () => {
    const parent = await createTask(me, { listId: general, title: "Parent" });
    await createTask(me, { listId: general, parentId: parent.id, title: "Existing child" });
    const t = await createTask(me, { listId: general, title: "Loose" });
    const child = await createTask(me, { listId: general, parentId: t.id, title: "Loose child" });

    await setParent(me, { taskId: t.id, parentId: parent.id });
    expect(await row(t.id)).toEqual({ parentId: parent.id, depth: 1, homeListId: general });
    expect((await row(child.id)).depth).toBe(2);
    expect((await getTask(me, { taskId: parent.id })).subtasks.map((x) => x.title)).toEqual(["Existing child", "Loose"]);

    await setParent(me, { taskId: t.id, parentId: null });
    expect(await row(t.id)).toEqual({ parentId: null, depth: 0, homeListId: general });
    expect((await row(child.id)).depth).toBe(1);
    const roots = await db.task.findMany({ where: { homeListId: general, parentId: null }, select: { title: true, position: true } });
    expect(roots.sort((x, y) => comparePositions(x.position, y.position)).at(-1)?.title).toBe("Loose"); // last root again

    const log = (await activity(t.id)).filter((a) => a.type === "PARENT_CHANGED").map((a) => a.payload);
    expect(log).toEqual([{ from: null, to: parent.id }, { from: parent.id, to: null }]);
  });

  it("takes the parent's home list for the whole subtree and drops a link to that list", async () => {
    const parent = await createTask(me, { listId: other, title: "In Other" });
    const t = await createTask(me, { listId: general, title: "In General" });
    const child = await createTask(me, { listId: general, parentId: t.id, title: "Child" });
    await link(t.id, other, "a5");
    await setParent(me, { taskId: t.id, parentId: parent.id });
    expect((await row(t.id)).homeListId).toBe(other);
    expect((await row(child.id)).homeListId).toBe(other);
    expect(await db.taskListLink.count({ where: { taskId: t.id } })).toBe(0);
    expect(await titles(general)).not.toContain("In General");
  });

  it("rejects cycles, other projects, too-deep subtrees and deleted parents", async () => {
    const a = await createTask(me, { listId: general, title: "A" });
    const b = await createTask(me, { listId: general, parentId: a.id, title: "B" });
    const c = await createTask(me, { listId: general, parentId: b.id, title: "C" });
    await expect(setParent(me, { taskId: a.id, parentId: a.id })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setParent(me, { taskId: a.id, parentId: c.id })).rejects.toMatchObject({ code: "VALIDATION" });

    // A (with two levels below) can't go under anything: it would reach depth 3.
    const d = await createTask(me, { listId: general, title: "D" });
    await expect(setParent(me, { taskId: a.id, parentId: d.id })).rejects.toMatchObject({ code: "VALIDATION" });
    // B (one level below) can go under D (depth 1, its child depth 2) but not under D's child.
    await setParent(me, { taskId: b.id, parentId: d.id });
    expect((await row(c.id)).depth).toBe(2);
    const e = await createTask(me, { listId: general, parentId: d.id, title: "E" });
    await expect(setParent(me, { taskId: b.id, parentId: e.id })).rejects.toMatchObject({ code: "VALIDATION" });

    const elsewhere = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Q" });
    const foreign = await createTask(me, { listId: elsewhere.firstListId, title: "Foreign" });
    await expect(setParent(me, { taskId: d.id, parentId: foreign.id })).rejects.toMatchObject({ code: "VALIDATION" });

    const gone = await createTask(me, { listId: general, title: "Gone" });
    await deleteTask(me, { taskId: gone.id });
    await expect(setParent(me, { taskId: d.id, parentId: gone.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is a no-op for the current parent and hides the task from non-members", async () => {
    const p = await createTask(me, { listId: general, title: "P" });
    const t = await createTask(me, { listId: general, parentId: p.id, title: "T" });
    await setParent(me, { taskId: t.id, parentId: p.id });
    expect((await types(t.id)).filter((x) => x === "PARENT_CHANGED")).toHaveLength(0);
    const outsider = await makeUser("outsider-setparent");
    await expect(setParent(as(outsider.id), { taskId: t.id, parentId: null })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("moveTask (6.5)", () => {
  it("moves a top-level task with its subtree, drops a link to the target, logs MOVED_TO_LIST", async () => {
    const x = await createTask(me, { listId: other, title: "X" });
    const t = await createTask(me, { listId: general, title: "T" });
    const child = await createTask(me, { listId: general, parentId: t.id, title: "Child" });
    await addTaskToList(me, { taskId: t.id, listId: other });

    await moveTask(me, { taskId: t.id, toListId: other, afterId: x.id }); // dropped above X
    const rows = await db.task.findMany({ where: { id: { in: [t.id, child.id] } }, select: { homeListId: true } });
    expect(rows.every((r) => r.homeListId === other)).toBe(true);
    expect(await db.taskListLink.count({ where: { taskId: t.id } })).toBe(0);
    expect(await titles(general)).toEqual([]);
    const roots = (await view(other)).filter((r) => r.parentId === null).sort((a, b) => comparePositions(a.position, b.position));
    expect(roots.map((r) => r.title)).toEqual(["T", "X"]);
    const moved = (await activity(t.id)).filter((a) => a.type === "MOVED_TO_LIST");
    expect(moved.map((a) => a.payload)).toEqual([{ fromListId: general, toListId: other }]);
  });

  it("rejects subtasks and lists of other projects; the home list is a no-op", async () => {
    const t = await createTask(me, { listId: general, title: "T" });
    const child = await createTask(me, { listId: general, parentId: t.id, title: "Child" });
    await expect(moveTask(me, { taskId: child.id, toListId: other })).rejects.toMatchObject({ code: "VALIDATION" });
    const q = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Q" });
    await expect(moveTask(me, { taskId: t.id, toListId: q.firstListId })).rejects.toMatchObject({ code: "VALIDATION" });
    await moveTask(me, { taskId: t.id, toListId: general });
    expect((await types(t.id)).filter((x) => x === "MOVED_TO_LIST")).toHaveLength(0);
  });
});

describe("addTaskToList / removeTaskFromList (6.6)", () => {
  it("links tasks and subtasks at the end of the target, then removes only the link", async () => {
    const x = await createTask(me, { listId: other, title: "X" });
    const t = await createTask(me, { listId: general, title: "T" });
    const child = await createTask(me, { listId: general, parentId: t.id, title: "Child" });
    await addTaskToList(me, { taskId: child.id, listId: other });
    const rows = await view(other);
    const linked = rows.find((r) => r.id === child.id)!;
    expect(linked.isLinkedHere).toBe(true);
    expect(comparePositions(linked.position, rows.find((r) => r.id === x.id)!.position)).toBeGreaterThan(0);
    expect((await getTask(me, { taskId: child.id })).linkedListIds).toEqual([other]);

    await removeTaskFromList(me, { taskId: child.id, listId: other });
    expect(await titles(other)).toEqual(["X"]);
    expect(await db.task.count({ where: { id: child.id, deletedAt: null } })).toBe(1);
    expect((await types(child.id)).filter((x) => x === "ADDED_TO_LIST" || x === "REMOVED_FROM_LIST")).toEqual([
      "ADDED_TO_LIST",
      "REMOVED_FROM_LIST",
    ]);
  });

  it("rejects the home list, duplicates, other projects and removing the home list", async () => {
    const t = await createTask(me, { listId: general, title: "T" });
    await expect(addTaskToList(me, { taskId: t.id, listId: general })).rejects.toMatchObject({ code: "VALIDATION" });
    await addTaskToList(me, { taskId: t.id, listId: other });
    await expect(addTaskToList(me, { taskId: t.id, listId: other })).rejects.toMatchObject({ code: "VALIDATION" });
    const q = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Q" });
    await expect(addTaskToList(me, { taskId: t.id, listId: q.firstListId })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(removeTaskFromList(me, { taskId: t.id, listId: general })).rejects.toMatchObject({ code: "VALIDATION" });
    const outsider = await makeUser("outsider-link");
    await expect(removeTaskFromList(as(outsider.id), { taskId: t.id, listId: other })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
