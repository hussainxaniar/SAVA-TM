import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  archiveProject,
  createProject,
  getProjectLanding,
  getSidebar,
  reorderProject,
  updateProject,
} from "@/server/services/projects";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "admin" | "member">>>;

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", admin: "ADMIN", member: "MEMBER" });
});

async function projects(names: string[]) {
  const ids: Record<string, string> = {};
  for (const name of names) ids[name] = (await createProject(as(s.users.owner.id), { spaceId: s.space.id, name })).projectId;
  return ids;
}
const order = async () => (await getSidebar(as(s.users.member.id), { spaceId: s.space.id })).projects.map((p) => p.name);

describe("updateProject", () => {
  it("lets any member rename, recolor and set an icon", async () => {
    const { A } = await projects(["A"]);
    await updateProject(as(s.users.member.id), { projectId: A, name: " Alpha ", color: "#DC2626", icon: "🚀" });
    await expect(db.project.findUniqueOrThrow({ where: { id: A } })).resolves.toMatchObject({
      name: "Alpha",
      color: "#DC2626",
      icon: "🚀",
    });
    await updateProject(as(s.users.member.id), { projectId: A, icon: null });
    expect((await db.project.findUniqueOrThrow({ where: { id: A } })).icon).toBeNull();
  });

  it("rejects bad input and non-members", async () => {
    const { A } = await projects(["A"]);
    const m = as(s.users.member.id);
    await expect(updateProject(m, { projectId: A, name: "  " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateProject(m, { projectId: A, color: "blue" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateProject(m, { projectId: A, icon: "x".repeat(17) })).rejects.toMatchObject({ code: "VALIDATION" });
    const outsider = await makeUser();
    await expect(updateProject(as(outsider.id), { projectId: A, name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("reorderProject", () => {
  it("moves projects above or below others", async () => {
    const { A, C } = await projects(["A", "B", "C"]);
    await reorderProject(as(s.users.member.id), { projectId: C, afterId: A });
    expect(await order()).toEqual(["C", "A", "B"]);
    await reorderProject(as(s.users.member.id), { projectId: C, beforeId: (await projects(["D"])).D });
    expect(await order()).toEqual(["A", "B", "D", "C"]);
    await reorderProject(as(s.users.member.id), { projectId: A });
    expect(await order()).toEqual(["B", "D", "C", "A"]);
  });

  it("rejects neighbours from another space, and non-members", async () => {
    const { A } = await projects(["A"]);
    const other = await makeSpace({ o: "OWNER" });
    const foreign = await createProject(as(other.users.o.id), { spaceId: other.space.id, name: "F" });
    await expect(
      reorderProject(as(s.users.owner.id), { projectId: A, afterId: foreign.projectId }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const outsider = await makeUser();
    await expect(reorderProject(as(outsider.id), { projectId: A })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("archiveProject", () => {
  it("is Admin-only and hides the project from the sidebar", async () => {
    const { A } = await projects(["A", "B"]);
    await expect(archiveProject(as(s.users.member.id), { projectId: A })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await archiveProject(as(s.users.admin.id), { projectId: A });
    await archiveProject(as(s.users.admin.id), { projectId: A }); // idempotent
    expect(await order()).toEqual(["B"]);
  });
});

describe("getSidebar", () => {
  it("returns active projects → lists → docs in position order, with each doc's first root page", async () => {
    const { A } = await projects(["A"]);
    const [general] = await db.list.findMany({ where: { projectId: A } });
    await db.list.createMany({
      data: [
        { projectId: A, name: "Zeta", position: "a2" },
        { projectId: A, name: "Beta", position: "a1" },
        { projectId: A, name: "Gone", position: "a3", archivedAt: new Date() },
      ],
    });
    const doc = await db.doc.create({
      data: { spaceId: s.space.id, projectId: A, title: "Handbook", position: "a0", createdById: s.users.owner.id },
    });
    const root2 = await db.docPage.create({
      data: { docId: doc.id, content: {}, position: "a1", createdById: s.users.owner.id, updatedById: s.users.owner.id },
    });
    const root1 = await db.docPage.create({
      data: { docId: doc.id, content: {}, position: "a0", createdById: s.users.owner.id, updatedById: s.users.owner.id },
    });
    await db.docPage.create({
      data: {
        docId: doc.id,
        parentId: root2.id,
        content: {},
        position: "Zz", // sorts before a0, but it's a child page
        createdById: s.users.owner.id,
        updatedById: s.users.owner.id,
      },
    });
    await db.doc.create({
      data: {
        spaceId: s.space.id,
        projectId: A,
        title: "Old",
        position: "a1",
        createdById: s.users.owner.id,
        archivedAt: new Date(),
      },
    });

    const { projects: [p] } = await getSidebar(as(s.users.member.id), { spaceId: s.space.id });
    expect(p.lists.map((l) => l.name)).toEqual(["General", "Beta", "Zeta"]);
    expect(p.lists[0].id).toBe(general.id);
    expect(p.docs).toEqual([{ id: doc.id, title: "Handbook", firstPageId: root1.id }]);
  });

  it("gives non-members NOT_FOUND", async () => {
    const outsider = await makeUser();
    await expect(getSidebar(as(outsider.id), { spaceId: s.space.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getProjectLanding", () => {
  it("returns the first active list", async () => {
    const { A } = await projects(["A"]);
    const [general] = await db.list.findMany({ where: { projectId: A } });
    const second = await db.list.create({ data: { projectId: A, name: "Second", position: "b0" } });
    await expect(getProjectLanding(as(s.users.member.id), { projectId: A })).resolves.toEqual({ listId: general.id });
    await db.list.update({ where: { id: general.id }, data: { archivedAt: new Date() } });
    await expect(getProjectLanding(as(s.users.member.id), { projectId: A })).resolves.toEqual({ listId: second.id });
  });
});
