import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { archiveDoc, createDoc, deletePage, getPage, savePage } from "@/server/services/docs";
import { createProject } from "@/server/services/projects";
import { getTaskLabels, searchTasks } from "@/server/services/task-links";
import { createTask, deleteTask, getTask } from "@/server/services/tasks";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
const link = (taskId: string, title = "T") => ({ type: "taskLink", attrs: { taskId, title } });
const doc = (...nodes: unknown[]) => ({ type: "doc", content: [{ type: "paragraph", content: nodes }] });

let s: Awaited<ReturnType<typeof makeSpace<"owner" | "member">>>;
let me: { userId: string };
let projectId: string;
let listId: string;
let docId: string;
let pageId: string;

async function save(content: unknown, page = pageId) {
  const current = await getPage(me, { pageId: page });
  const r = await savePage(me, { pageId: page, content, baseUpdatedAt: current.updatedAt });
  expect(r.conflict).toBeFalsy();
}
const linksOf = async (page = pageId) => (await db.docTaskLink.findMany({ where: { pageId: page } })).map((l) => l.taskId).sort();

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", member: "MEMBER" });
  me = as(s.users.member.id);
  const p = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" });
  projectId = p.projectId;
  listId = p.firstListId;
  ({ docId, firstPageId: pageId } = await createDoc(me, { projectId, title: "Handbook" }));
});

describe("the link index follows the page content", () => {
  it("adds, keeps and removes links as the page is saved, once per task", async () => {
    const a = await createTask(me, { listId, title: "Alpha" });
    const b = await createTask(me, { listId, title: "Beta" });
    await save(doc(link(a.id), { type: "text", text: " and " }, link(a.id), link(b.id)));
    expect(await linksOf()).toEqual([a.id, b.id].sort());
    await save(doc(link(b.id)));
    expect(await linksOf()).toEqual([b.id]);
    await save(doc({ type: "text", text: "no links" }));
    expect(await linksOf()).toEqual([]);
  });

  it("ignores ids of tasks that are not in the page's space and a stale save writes nothing", async () => {
    const mine = await createTask(me, { listId, title: "Mine" });
    const other = await makeSpace({ boss: "OWNER" });
    const op = await createProject(as(other.users.boss.id), { spaceId: other.space.id, name: "Theirs" });
    const foreign = await createTask(as(other.users.boss.id), { listId: op.firstListId, title: "Secret" });
    await save(doc(link(mine.id), link(foreign.id), link("does-not-exist")));
    expect(await linksOf()).toEqual([mine.id]);

    const stale = await savePage(me, { pageId, content: doc(link(foreign.id)), baseUpdatedAt: "2020-01-01T00:00:00.000Z" });
    expect(stale.conflict).toBe(true);
    expect(await linksOf()).toEqual([mine.id]); // a refused save leaves the index alone
  });

  it("a title-only save keeps the links, and deleting the page removes them", async () => {
    const a = await createTask(me, { listId, title: "Alpha" });
    await save(doc(link(a.id)));
    const current = await getPage(me, { pageId });
    await savePage(me, { pageId, title: "Renamed", baseUpdatedAt: current.updatedAt });
    expect(await linksOf()).toEqual([a.id]);
    const second = await db.docPage.create({ data: { docId, title: "Second", content: JSON.parse(JSON.stringify(doc(link(a.id)))), position: "b", createdById: me.userId, updatedById: me.userId } });
    await save(doc(link(a.id)), second.id);
    await deletePage(me, { pageId: second.id });
    expect(await db.docTaskLink.count({ where: { pageId: second.id } })).toBe(0);
    expect(await linksOf()).toEqual([a.id]);
  });
});

describe("getTask lists the pages that link it", () => {
  it("returns doc and page names, skips archived docs, and survives a deleted task's chip", async () => {
    const a = await createTask(me, { listId, title: "Alpha" });
    expect((await getTask(me, { taskId: a.id })).linkedDocs).toEqual([]);
    await save(doc(link(a.id)));
    const second = await createDoc(me, { projectId, title: "Another doc" });
    await save(doc(link(a.id)), second.firstPageId);

    const docs = (await getTask(me, { taskId: a.id })).linkedDocs;
    expect(docs.map((d) => [d.docTitle, d.pageTitle])).toEqual([["Another doc", "Untitled"], ["Handbook", "Untitled"]]);
    expect(docs[1]).toMatchObject({ pageId, docId, projectId });

    await archiveDoc(me, { docId: second.docId });
    expect((await getTask(me, { taskId: a.id })).linkedDocs.map((d) => d.docTitle)).toEqual(["Handbook"]);

    await deleteTask(me, { taskId: a.id }); // soft delete: the chip degrades, nothing breaks
    expect(await getTaskLabels(me, { spaceId: s.space.id, taskIds: [a.id] })).toEqual([]);
  });
});

describe("searchTasks and getTaskLabels", () => {
  it("search matches titles of this space, ignores case, deleted tasks and other spaces, and limits the list", async () => {
    await createTask(me, { listId, title: "Write the Launch brief" });
    const gone = await createTask(me, { listId, title: "Launch party" });
    await deleteTask(me, { taskId: gone.id });
    for (let i = 0; i < 10; i++) await createTask(me, { listId, title: `Filler ${i}` });
    const other = await makeSpace({ boss: "OWNER" });
    const op = await createProject(as(other.users.boss.id), { spaceId: other.space.id, name: "Theirs" });
    await createTask(as(other.users.boss.id), { listId: op.firstListId, title: "Launch secret" });

    expect((await searchTasks(me, { spaceId: s.space.id, query: "  launch " })).map((t) => t.title)).toEqual(["Write the Launch brief"]);
    expect(await searchTasks(me, { spaceId: s.space.id })).toHaveLength(8);
    const [hit] = await searchTasks(me, { spaceId: s.space.id, query: "brief" });
    expect(hit).toMatchObject({ projectId, listId, completed: false, status: { category: "TODO" } });
  });

  it("labels give live titles and drop foreign or deleted tasks; outsiders get NOT_FOUND", async () => {
    const t = await createTask(me, { listId, title: "Alpha" });
    const labels = await getTaskLabels(me, { spaceId: s.space.id, taskIds: [t.id, t.id, "nope"] });
    expect(labels.map((l) => l.title)).toEqual(["Alpha"]);
    const outsider = await makeUser("outsider-links");
    await expect(searchTasks(as(outsider.id), { spaceId: s.space.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getTaskLabels(as(outsider.id), { spaceId: s.space.id, taskIds: [t.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
