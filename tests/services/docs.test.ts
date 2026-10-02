import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  archiveDoc,
  createDoc,
  createPage,
  deletePage,
  getDocView,
  getPage,
  getPageTree,
  movePage,
  renameDoc,
  reorderDoc,
  savePage,
} from "@/server/services/docs";
import { createProject } from "@/server/services/projects";
import { getSidebar } from "@/server/services/projects";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "member" | "other">>>;
let me: { userId: string };
let projectId: string;

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", member: "MEMBER", other: "MEMBER" });
  me = as(s.users.member.id);
  projectId = (await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" })).projectId;
});

const titles = async (docId: string) => (await getPageTree(me, { docId })).map((p) => p.title).sort();

describe("docs", () => {
  it("creates a doc with one empty page, renames, reorders and archives it", async () => {
    const a = await createDoc(me, { projectId });
    const b = await createDoc(me, { projectId, title: "  Handbook " });
    const tree = await getPageTree(me, { docId: a.docId });
    expect(tree).toEqual([expect.objectContaining({ id: a.firstPageId, title: "Untitled", parentId: null })]);
    const view = await getDocView(me, { docId: a.docId, pageId: a.firstPageId });
    expect(view.doc).toMatchObject({ title: "Untitled doc", projectId, projectName: "P" });
    expect(view.page.content).toEqual({ type: "doc", content: [] });

    await renameDoc(me, { docId: b.docId, title: "Team handbook" });
    await reorderDoc(me, { docId: b.docId, afterId: a.docId });
    let docs = (await getSidebar(me, { spaceId: s.space.id })).projects[0].docs;
    expect(docs.map((d) => d.title)).toEqual(["Team handbook", "Untitled doc"]);
    expect(docs[0].firstPageId).toBe(b.firstPageId);

    await archiveDoc(as(s.users.other.id), { docId: a.docId }); // any member
    docs = (await getSidebar(me, { spaceId: s.space.id })).projects[0].docs;
    expect(docs.map((d) => d.title)).toEqual(["Team handbook"]);
    await expect(getDocView(me, { docId: a.docId, pageId: a.firstPageId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides docs and pages from non-members and rejects a page from another doc", async () => {
    const a = await createDoc(me, { projectId });
    const b = await createDoc(me, { projectId });
    const outsider = await makeUser("outsider-docs");
    await expect(getPage(as(outsider.id), { pageId: a.firstPageId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createPage(as(outsider.id), { docId: a.docId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getDocView(me, { docId: a.docId, pageId: b.firstPageId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("pages: create and move (max three levels)", () => {
  it("creates nested pages up to depth 3 and rejects a fourth level", async () => {
    const d = await createDoc(me, { projectId });
    const l1 = await createPage(me, { docId: d.docId, parentId: d.firstPageId, title: "L1" });
    const l2 = await createPage(me, { docId: d.docId, parentId: l1.pageId, title: "L2" });
    await expect(createPage(me, { docId: d.docId, parentId: l2.pageId })).rejects.toMatchObject({ code: "VALIDATION" });
    const other = await createDoc(me, { projectId });
    await expect(createPage(me, { docId: d.docId, parentId: other.firstPageId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await titles(d.docId)).toEqual(["L1", "L2", "Untitled"]);
  });

  it("moves a page with its subtree, ordering it among its new siblings, and rejects cycles and deep moves", async () => {
    const d = await createDoc(me, { projectId });
    const root = d.firstPageId;
    const a = (await createPage(me, { docId: d.docId, title: "A" })).pageId;
    const b = (await createPage(me, { docId: d.docId, title: "B" })).pageId;
    const a1 = (await createPage(me, { docId: d.docId, parentId: a, title: "A1" })).pageId;
    const a2 = (await createPage(me, { docId: d.docId, parentId: a1, title: "A2" })).pageId;

    // Cycle: A under its own child; and too deep: A (height 2) under B.
    await expect(movePage(me, { pageId: a, parentId: a2 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(movePage(me, { pageId: a, parentId: b })).rejects.toMatchObject({ code: "VALIDATION" });
    // A1 (height 1) under B is fine: depth 1 + 1 = 2.
    await movePage(me, { pageId: a1, parentId: b });
    let tree = await getPageTree(me, { docId: d.docId });
    expect(tree.find((p) => p.id === a1)?.parentId).toBe(b);
    expect(tree.find((p) => p.id === a2)?.parentId).toBe(a1);

    // Reorder at the top level: B before the root page.
    await movePage(me, { pageId: b, parentId: null, afterId: root });
    tree = await getPageTree(me, { docId: d.docId });
    const top = tree.filter((p) => p.parentId === null).sort((x, y) => (x.position < y.position ? -1 : 1)).map((p) => p.title);
    expect(top.slice(0, 2)).toEqual(["B", "Untitled"]);
  });
});

describe("savePage (11.2)", () => {
  it("saves title and content, and refuses a stale save with who changed it", async () => {
    const d = await createDoc(me, { projectId });
    const other = as(s.users.other.id);
    const v0 = (await getPage(me, { pageId: d.firstPageId })).updatedAt;

    const saved = await savePage(me, { pageId: d.firstPageId, title: "Plan", content: doc("hello"), baseUpdatedAt: v0 });
    expect(saved.conflict).toBeFalsy();
    const v1 = (saved as { updatedAt: string }).updatedAt;
    expect(new Date(v1).getTime()).toBeGreaterThan(new Date(v0).getTime());
    expect(await getPage(me, { pageId: d.firstPageId })).toMatchObject({ title: "Plan", updatedBy: { id: me.userId } });

    // The other member still holds v0: their save conflicts, nothing is written, and they learn who won.
    const stale = await savePage(other, { pageId: d.firstPageId, content: doc("theirs"), baseUpdatedAt: v0 });
    expect(stale).toMatchObject({ conflict: true, updatedBy: { id: me.userId }, updatedAt: v1 });
    expect((await getPage(me, { pageId: d.firstPageId })).content).toEqual(doc("hello"));

    // Overwrite = resend with the server's current version.
    const over = await savePage(other, { pageId: d.firstPageId, content: doc("theirs"), baseUpdatedAt: v1 });
    expect(over.conflict).toBeFalsy();
    expect(await getPage(me, { pageId: d.firstPageId })).toMatchObject({ content: doc("theirs"), updatedBy: { id: other.userId } });
  });

  it("validates input and only one of two saves from the same version wins", async () => {
    const d = await createDoc(me, { projectId });
    const v0 = (await getPage(me, { pageId: d.firstPageId })).updatedAt;
    await expect(savePage(me, { pageId: d.firstPageId, content: { type: "paragraph" }, baseUpdatedAt: v0 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(savePage(me, { pageId: d.firstPageId, title: "  ", baseUpdatedAt: v0 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(savePage(me, { pageId: d.firstPageId, title: "x", baseUpdatedAt: "nope" })).rejects.toMatchObject({ code: "VALIDATION" });
    const results = await Promise.all([
      savePage(me, { pageId: d.firstPageId, title: "One", baseUpdatedAt: v0 }),
      savePage(as(s.users.other.id), { pageId: d.firstPageId, title: "Two", baseUpdatedAt: v0 }),
    ]);
    expect(results.filter((r) => r.conflict).length).toBe(1);
  });
});

describe("deletePage", () => {
  it("deletes a page with its children, but never the last page of a doc", async () => {
    const d = await createDoc(me, { projectId });
    const a = (await createPage(me, { docId: d.docId, title: "A" })).pageId;
    await createPage(me, { docId: d.docId, parentId: a, title: "A1" });
    await deletePage(me, { pageId: a });
    expect(await titles(d.docId)).toEqual(["Untitled"]);
    expect(await db.docPage.count({ where: { docId: d.docId } })).toBe(1);
    await expect(deletePage(me, { pageId: d.firstPageId })).rejects.toMatchObject({ code: "VALIDATION" });

    // A subtree that holds every page can't be deleted either.
    const x = await createDoc(me, { projectId });
    await createPage(me, { docId: x.docId, parentId: x.firstPageId, title: "child" });
    await expect(deletePage(me, { pageId: x.firstPageId })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
