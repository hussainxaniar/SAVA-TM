import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addComment, deleteComment, editComment, getFeed } from "@/server/services/comments";
import { createList } from "@/server/services/lists";
import { createProject } from "@/server/services/projects";
import { addTaskToList, createTask, deleteTask, setAssignees, updateTask } from "@/server/services/tasks";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "admin" | "member" | "other">>>;
let me: { userId: string };
let taskId: string;
let listId: string;
let otherList: string;

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", admin: "ADMIN", member: "MEMBER", other: "MEMBER" });
  me = as(s.users.member.id);
  const p = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" });
  listId = p.firstListId;
  otherList = (await createList(me, { projectId: p.projectId, name: "Other" })).listId;
  taskId = (await createTask(me, { listId, title: "T" })).id;
});

describe("addComment", () => {
  it("stores the body and plain text, logs COMMENT_ADDED and returns the feed item", async () => {
    const item = await addComment(me, { taskId, body: doc("Looks  good ") });
    expect(item).toMatchObject({ kind: "comment", author: { id: me.userId }, deleted: false, canEdit: true, canDelete: true });
    const row = await db.comment.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.bodyText).toBe("Looks good");
    const log = await db.activity.findMany({ where: { taskId, type: "COMMENT_ADDED" } });
    expect(log.map((a) => a.payload)).toEqual([{ commentId: item.id }]);
  });

  it("rejects empty or non-doc bodies, deleted tasks and non-members", async () => {
    await expect(addComment(me, { taskId, body: doc("   ") })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addComment(me, { taskId, body: { type: "paragraph" } })).rejects.toMatchObject({ code: "VALIDATION" });
    const outsider = await makeUser("outsider-comment");
    await expect(addComment(as(outsider.id), { taskId, body: doc("hi") })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await deleteTask(me, { taskId });
    await expect(addComment(me, { taskId, body: doc("hi") })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("editComment / deleteComment (6.10)", () => {
  it("lets only the author edit; the author or an Admin delete, softly", async () => {
    const c = await addComment(me, { taskId, body: doc("first") });
    await expect(editComment(as(s.users.other.id), { commentId: c.id, body: doc("x") })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await editComment(me, { commentId: c.id, body: doc("second") });
    const edited = await db.comment.findUniqueOrThrow({ where: { id: c.id } });
    expect(edited.bodyText).toBe("second");
    expect(edited.editedAt).not.toBeNull();

    await expect(deleteComment(as(s.users.other.id), { commentId: c.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteComment(as(s.users.admin.id), { commentId: c.id });
    await deleteComment(me, { commentId: c.id }); // already deleted: no-op
    await expect(editComment(me, { commentId: c.id, body: doc("third") })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const [item] = (await getFeed(me, { taskId, filter: "comments" })).filter((i) => i.kind === "comment");
    expect(item).toMatchObject({ id: c.id, deleted: true, body: null, canEdit: false, canDelete: false });
  });
});

describe("getFeed", () => {
  it("merges comments and activity oldest first, hides COMMENT_ADDED and labels ids", async () => {
    const statuses = await db.status.findMany({ where: { project: { lists: { some: { id: listId } } } } });
    const active = statuses.find((x) => x.category === "ACTIVE")!;
    await updateTask(me, { taskId, statusId: active.id });
    await setAssignees(me, { taskId, userIds: [s.users.other.id] });
    await addTaskToList(me, { taskId, listId: otherList });
    const c = await addComment(me, { taskId, body: doc("hello") });

    const feed = await getFeed(me, { taskId });
    expect(feed.map((i) => (i.kind === "comment" ? "comment" : i.type))).toEqual([
      "TASK_CREATED",
      "STATUS_CHANGED",
      "ASSIGNEE_ADDED",
      "ADDED_TO_LIST",
      "comment",
    ]);
    const status = feed.find((i) => i.kind === "activity" && i.type === "STATUS_CHANGED");
    expect(status && status.kind === "activity" && status.labels[active.id]).toBe(active.name);
    const assignee = feed.find((i) => i.kind === "activity" && i.type === "ASSIGNEE_ADDED");
    expect(assignee && assignee.kind === "activity" && Object.values(assignee.labels)).toEqual([s.users.other.name]);
    const added = feed.find((i) => i.kind === "activity" && i.type === "ADDED_TO_LIST");
    expect(added && added.kind === "activity" && added.labels[otherList]).toBe("Other");

    expect((await getFeed(me, { taskId, filter: "comments" })).map((i) => i.id)).toEqual([c.id]);
    // An Admin may delete others' comments; a plain member may not.
    const asAdmin = (await getFeed(as(s.users.admin.id), { taskId, filter: "comments" }))[0];
    const asOther = (await getFeed(as(s.users.other.id), { taskId, filter: "comments" }))[0];
    expect(asAdmin).toMatchObject({ canEdit: false, canDelete: true });
    expect(asOther).toMatchObject({ canEdit: false, canDelete: false });
  });
});
