import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createProject, getProjectSettings } from "@/server/services/projects";
import {
  createStatus,
  deleteStatus,
  listStatuses,
  reorderStatus,
  updateStatus,
} from "@/server/services/statuses";
import { makeSpace, makeTask, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "admin" | "member">>>;
let projectId: string;
let listId: string;
let st: Record<"todo" | "active" | "done", string>; // default statuses

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", admin: "ADMIN", member: "MEMBER" });
  ({ projectId, firstListId: listId } = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" }));
  const statuses = await db.status.findMany({ where: { projectId } });
  const by = (c: string) => statuses.find((x) => x.category === c)!.id;
  st = { todo: by("TODO"), active: by("ACTIVE"), done: by("DONE") };
});

const task = (statusId: string, extra: { completedAt?: Date | null; deletedAt?: Date | null; title?: string } = {}) =>
  makeTask({
    spaceId: s.space.id,
    projectId,
    homeListId: listId,
    statusId,
    createdById: s.users.owner.id,
    title: extra.title ?? "T",
    position: "a0",
    ...extra,
  });
const names = async () => (await listStatuses(as(s.users.member.id), { projectId })).map((x) => x.name);

describe("listStatuses / createStatus", () => {
  it("lists in order; an Admin appends a status at the end", async () => {
    expect(await names()).toEqual(["To do", "In progress", "Done"]);
    const review = await createStatus(as(s.users.admin.id), {
      projectId,
      name: " Review ",
      color: "#A855F7",
      category: "ACTIVE",
    });
    expect(review).toMatchObject({ name: "Review", color: "#A855F7", category: "ACTIVE" });
    expect(await names()).toEqual(["To do", "In progress", "Done", "Review"]);
  });

  it("is Admin-only, needs a unique name (ignoring case) and a hex color", async () => {
    await expect(
      createStatus(as(s.users.member.id), { projectId, name: "X", color: "#000000", category: "TODO" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const a = as(s.users.admin.id);
    await expect(createStatus(a, { projectId, name: "dONE", color: "#000000", category: "DONE" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(createStatus(a, { projectId, name: "Y", color: "red", category: "TODO" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const outsider = await makeUser();
    await expect(listStatuses(as(outsider.id), { projectId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateStatus", () => {
  it("renames and recolors, rejecting a clashing name", async () => {
    const a = as(s.users.admin.id);
    await updateStatus(a, { statusId: st.active, name: "Doing", color: "#0EA5E9" });
    expect(await names()).toEqual(["To do", "Doing", "Done"]);
    await expect(updateStatus(a, { statusId: st.active, name: "to do" })).rejects.toMatchObject({ code: "VALIDATION" });
    await updateStatus(a, { statusId: st.active, name: "doing" }); // same status, case change is fine
    await expect(updateStatus(as(s.users.member.id), { statusId: st.active, name: "Z" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("never recategorizes the last TODO or the last DONE status", async () => {
    const a = as(s.users.admin.id);
    await expect(updateStatus(a, { statusId: st.todo, category: "ACTIVE" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateStatus(a, { statusId: st.done, category: "ACTIVE" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("keeps completedAt in step when a status moves into or out of DONE", async () => {
    const a = as(s.users.admin.id);
    const t = await task(st.active);
    await updateStatus(a, { statusId: st.active, category: "DONE" });
    expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).completedAt).toBeInstanceOf(Date);
    await updateStatus(a, { statusId: st.active, category: "TODO" }); // "Done" still exists
    expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).completedAt).toBeNull();
  });
});

describe("reorderStatus", () => {
  it("moves a status among its project's statuses", async () => {
    await reorderStatus(as(s.users.admin.id), { statusId: st.done, afterId: st.todo });
    expect(await names()).toEqual(["Done", "To do", "In progress"]);
    await expect(reorderStatus(as(s.users.member.id), { statusId: st.done })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("deleteStatus", () => {
  it("moves every task (soft-deleted too) to the replacement, logging STATUS_CHANGED each", async () => {
    const live = await task(st.active);
    const gone = await task(st.active, { deletedAt: new Date() });
    await deleteStatus(as(s.users.admin.id), { statusId: st.active, replacementStatusId: st.todo });

    expect(await names()).toEqual(["To do", "Done"]);
    for (const t of [live, gone]) {
      expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).statusId).toBe(st.todo);
      await expect(db.activity.findMany({ where: { taskId: t.id } })).resolves.toEqual([
        expect.objectContaining({
          type: "STATUS_CHANGED",
          actorId: s.users.admin.id,
          payload: { from: st.active, to: st.todo },
        }),
      ]);
    }
  });

  it("clears completedAt when DONE tasks move to a non-DONE replacement", async () => {
    const a = as(s.users.admin.id);
    const extraDone = await createStatus(a, { projectId, name: "Shipped", color: "#16A34A", category: "DONE" });
    const t = await task(extraDone.id, { completedAt: new Date() });
    await deleteStatus(a, { statusId: extraDone.id, replacementStatusId: st.active });
    expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).completedAt).toBeNull();
  });

  it("rejects a bad replacement, the last DONE status, and Members", async () => {
    const a = as(s.users.admin.id);
    const other = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Other" });
    const foreign = await db.status.findFirstOrThrow({ where: { projectId: other.projectId } });
    await expect(deleteStatus(a, { statusId: st.active, replacementStatusId: st.active })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(deleteStatus(a, { statusId: st.active, replacementStatusId: foreign.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(deleteStatus(a, { statusId: st.done, replacementStatusId: st.todo })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      deleteStatus(as(s.users.member.id), { statusId: st.active, replacementStatusId: st.todo }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await names()).toEqual(["To do", "In progress", "Done"]);
  });

  it("keeps a TODO status when two Admins delete the two TODO statuses at once", async () => {
    const todo2 = await createStatus(as(s.users.owner.id), { projectId, name: "Backlog", color: "#94A3B8", category: "TODO" });
    const results = await Promise.allSettled([
      deleteStatus(as(s.users.admin.id), { statusId: st.todo, replacementStatusId: st.active }),
      deleteStatus(as(s.users.owner.id), { statusId: todo2.id, replacementStatusId: st.active }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.status.count({ where: { projectId, category: "TODO" } })).toBe(1);
  });
});

describe("getProjectSettings", () => {
  it("counts live tasks per status and per active list", async () => {
    await task(st.todo);
    await task(st.todo);
    await task(st.todo, { deletedAt: new Date() });
    await db.list.create({ data: { projectId, name: "Old", position: "b0", archivedAt: new Date() } });
    const settings = await getProjectSettings(as(s.users.member.id), { projectId });
    expect(settings.project).toMatchObject({ id: projectId, name: "P" });
    expect(settings.statuses.map((x) => [x.name, x.taskCount])).toEqual([
      ["To do", 2],
      ["In progress", 0],
      ["Done", 0],
    ]);
    expect(settings.lists).toEqual([{ id: listId, name: "General", subtaskDisplay: "NESTED", taskCount: 2 }]);
  });
});
