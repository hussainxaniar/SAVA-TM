import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { comparePositions } from "@/lib/position";
import { db } from "@/server/db";
import { createList, deleteList, reorderList, updateList } from "@/server/services/lists";
import { createProject, getSidebar } from "@/server/services/projects";
import { makeSpace, makeTask, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "admin" | "member">>>;
let projectId: string;
let general: string;
let todo: string;

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", admin: "ADMIN", member: "MEMBER" });
  ({ projectId, firstListId: general } = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" }));
  todo = (await db.status.findFirstOrThrow({ where: { projectId, category: "TODO" } })).id;
});

const listNames = async () =>
  (await getSidebar(as(s.users.member.id), { spaceId: s.space.id })).projects.find((p) => p.id === projectId)!.lists.map((l) => l.name);

const task = (homeListId: string, title: string, position: string, parent?: { id: string; depth: number }) =>
  makeTask({
    spaceId: s.space.id,
    projectId,
    homeListId,
    statusId: todo,
    createdById: s.users.owner.id,
    title,
    position,
    parentId: parent?.id,
    depth: parent ? parent.depth + 1 : 0,
  });

describe("createList / updateList / reorderList", () => {
  it("lets any member create, rename, change display and reorder lists", async () => {
    const m = as(s.users.member.id);
    const { listId: design } = await createList(m, { projectId, name: " Design " });
    const { listId: qa } = await createList(m, { projectId, name: "QA" });
    expect(await listNames()).toEqual(["General", "Design", "QA"]);

    await updateList(m, { listId: design, name: "Design system", subtaskDisplay: "SEPARATE" });
    await expect(db.list.findUniqueOrThrow({ where: { id: design } })).resolves.toMatchObject({
      name: "Design system",
      subtaskDisplay: "SEPARATE",
    });
    await reorderList(m, { listId: qa, afterId: general });
    expect(await listNames()).toEqual(["QA", "General", "Design system"]);
  });

  it("rejects empty names and non-members", async () => {
    await expect(createList(as(s.users.member.id), { projectId, name: " " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateList(as(s.users.member.id), { listId: general, name: "" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const outsider = await makeUser();
    await expect(createList(as(outsider.id), { projectId, name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("deleteList", () => {
  it("moves home tasks with subtrees to the end of the target, fixes links, logs, and deletes", async () => {
    const a = as(s.users.admin.id);
    const { listId: doomed } = await createList(a, { projectId, name: "Doomed" });
    const { listId: third } = await createList(a, { projectId, name: "Third" });

    const existing = await task(general, "Already in General", "a5");
    const first = await task(doomed, "First", "a0");
    const second = await task(doomed, "Second", "a1");
    const child = await task(doomed, "Child", "a0", first);
    const grandchild = await task(doomed, "Grandchild", "a0", child);
    // `second` is also linked into General (the target) → that link must go.
    await db.taskListLink.create({ data: { taskId: second.id, listId: general, position: "b0", addedById: s.users.owner.id } });
    // A task from Third is linked into Doomed → that link must go, with REMOVED_FROM_LIST.
    const visitor = await task(third, "Visitor", "a0");
    await db.taskListLink.create({ data: { taskId: visitor.id, listId: doomed, position: "a0", addedById: s.users.owner.id } });

    await deleteList(a, { listId: doomed, targetListId: general });

    expect(await listNames()).toEqual(["General", "Third"]);
    const roots = await db.task.findMany({ where: { homeListId: general, parentId: null } });
    const ordered = roots.sort((x, y) => comparePositions(x.position, y.position)).map((t) => t.title);
    expect(ordered).toEqual(["Already in General", "First", "Second"]);
    for (const t of [child, grandchild]) {
      await expect(db.task.findUniqueOrThrow({ where: { id: t.id } })).resolves.toMatchObject({
        homeListId: general,
        parentId: t.parentId,
        position: "a0",
      });
    }
    expect(await db.taskListLink.count({ where: { taskId: second.id } })).toBe(0);
    expect(await db.taskListLink.count({ where: { taskId: visitor.id } })).toBe(0);

    const activity = await db.activity.findMany({ where: { spaceId: s.space.id }, orderBy: { createdAt: "asc" } });
    const summary = activity.map((x) => [x.taskId, x.type]);
    expect(summary).toEqual(
      expect.arrayContaining([
        [first.id, "MOVED_TO_LIST"],
        [second.id, "MOVED_TO_LIST"],
        [visitor.id, "REMOVED_FROM_LIST"],
      ]),
    );
    expect(activity).toHaveLength(3); // subtasks move with their parent and aren't logged separately
    expect(activity.find((x) => x.taskId === first.id)!.payload).toEqual({ fromListId: doomed, toListId: general });
    expect(existing.homeListId).toBe(general);
  });

  it("requires Admin and another active list in the same project", async () => {
    const a = as(s.users.admin.id);
    const { listId: second } = await createList(a, { projectId, name: "Second" });
    const other = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Other" });
    const archived = await db.list.create({ data: { projectId, name: "Archived", position: "z0", archivedAt: new Date() } });

    await expect(deleteList(as(s.users.member.id), { listId: second, targetListId: general })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(deleteList(a, { listId: general, targetListId: general })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(deleteList(a, { listId: general, targetListId: other.firstListId })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(deleteList(a, { listId: general, targetListId: archived.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await listNames()).toEqual(["General", "Second"]);
  });

  it("loses no tasks when two Admins delete two lists into each other at once", async () => {
    const { listId: second } = await createList(as(s.users.admin.id), { projectId, name: "Second" });
    await task(general, "G", "a0");
    await task(second, "S", "a0");
    const results = await Promise.allSettled([
      deleteList(as(s.users.admin.id), { listId: general, targetListId: second }),
      deleteList(as(s.users.owner.id), { listId: second, targetListId: general }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lists = await db.list.findMany({ where: { projectId } });
    expect(lists).toHaveLength(1);
    expect(await db.task.count({ where: { projectId, homeListId: lists[0].id } })).toBe(2);
  });
});
