import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { comparePositions } from "@/lib/position";
import { createSpace, getSpaceLanding, listMySpaces } from "@/server/services/spaces";
import { createProject } from "@/server/services/projects";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

describe("createSpace", () => {
  it("makes the creator OWNER and adds Getting started with default statuses and General", async () => {
    const user = await makeUser("creator");
    const { spaceId } = await createSpace({ userId: user.id }, { name: "  Acme  " });

    const space = await db.space.findUniqueOrThrow({
      where: { id: spaceId },
      include: {
        members: true,
        projects: { include: { statuses: { orderBy: { position: "asc" } }, lists: true } },
      },
    });
    expect(space.name).toBe("Acme");
    expect(space.createdById).toBe(user.id);
    expect(space.members).toEqual([expect.objectContaining({ userId: user.id, role: "OWNER" })]);
    expect(space.projects).toHaveLength(1);

    const [project] = space.projects;
    expect(project.name).toBe("Getting started");
    expect(project.statuses.map(({ name, color, category }) => ({ name, color, category }))).toEqual([
      { name: "To do", color: "#94A3B8", category: "TODO" },
      { name: "In progress", color: "#3B82F6", category: "ACTIVE" },
      { name: "Done", color: "#22C55E", category: "DONE" },
    ]);
    expect(project.lists.map((l) => l.name)).toEqual(["General"]);
  });

  it("rejects an empty name without creating anything", async () => {
    const user = await makeUser();
    await expect(createSpace({ userId: user.id }, { name: "   " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(db.space.count({ where: { createdById: user.id } })).resolves.toBe(0);
  });
});

describe("listMySpaces", () => {
  it("lists only the caller's memberships, oldest first, with role", async () => {
    const { space: a, users } = await makeSpace({ me: "ADMIN", other: "OWNER" });
    const { spaceId: b } = await createSpace({ userId: users.me.id }, { name: "Mine" });
    await makeSpace({ stranger: "OWNER" });

    await expect(listMySpaces({ userId: users.me.id })).resolves.toEqual([
      { id: a.id, name: "Test space", icon: null, role: "ADMIN" },
      { id: b, name: "Mine", icon: null, role: "OWNER" },
    ]);
  });

  it("is empty for a user with no spaces", async () => {
    const user = await makeUser();
    await expect(listMySpaces({ userId: user.id })).resolves.toEqual([]);
  });
});

describe("getSpaceLanding", () => {
  it("returns the first active project's first active list", async () => {
    const user = await makeUser();
    const ctx = { userId: user.id };
    const { spaceId } = await createSpace(ctx, { name: "S" });
    const first = await getSpaceLanding(ctx, { spaceId });
    expect(first).not.toBeNull();

    // Archive the first project → the next one is used.
    const second = await createProject(ctx, { spaceId, name: "Second" });
    await db.project.update({ where: { id: first!.projectId }, data: { archivedAt: new Date() } });
    await expect(getSpaceLanding(ctx, { spaceId })).resolves.toEqual({
      projectId: second.projectId,
      listId: second.firstListId,
    });

    // No active project left → null.
    await db.project.update({ where: { id: second.projectId }, data: { archivedAt: new Date() } });
    await expect(getSpaceLanding(ctx, { spaceId })).resolves.toBeNull();
  });

  it("gives a non-member NOT_FOUND", async () => {
    const { space } = await makeSpace({ owner: "OWNER" });
    const outsider = await makeUser();
    await expect(getSpaceLanding({ userId: outsider.id }, { spaceId: space.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("createProject", () => {
  it("lets a Member create a project at the end, with defaults and General", async () => {
    const { space, users } = await makeSpace({ owner: "OWNER", member: "MEMBER" });
    const a = await createProject({ userId: users.owner.id }, { spaceId: space.id, name: "A" });
    const b = await createProject({ userId: users.member.id }, { spaceId: space.id, name: "B", color: "#2563EB" });

    const [pa, pb] = await Promise.all(
      [a, b].map((p) =>
        db.project.findUniqueOrThrow({ where: { id: p.projectId }, include: { statuses: true, lists: true } }),
      ),
    );
    expect(comparePositions(pa.position, pb.position)).toBe(-1);
    expect(pa.color).toBe("#64748B");
    expect(pb.color).toBe("#2563EB");
    expect(pb.statuses).toHaveLength(3);
    expect(pb.lists).toEqual([expect.objectContaining({ id: b.firstListId, name: "General" })]);
  });

  it("copies statuses from another project in the same space", async () => {
    const { space, users } = await makeSpace({ owner: "OWNER" });
    const ctx = { userId: users.owner.id };
    const src = await createProject(ctx, { spaceId: space.id, name: "Source" });
    await db.status.create({
      data: { projectId: src.projectId, name: "Review", color: "#A855F7", category: "ACTIVE", position: "a1V" },
    });

    const copy = await createProject(ctx, { spaceId: space.id, name: "Copy", copyStatusesFromProjectId: src.projectId });
    const statuses = await db.status.findMany({ where: { projectId: copy.projectId }, orderBy: { position: "asc" } });
    expect(statuses.map((s) => s.name)).toEqual(["To do", "In progress", "Review", "Done"]);
  });

  it("rejects copying statuses from another space", async () => {
    const { space, users } = await makeSpace({ owner: "OWNER" });
    const other = await makeSpace({ x: "OWNER" });
    const foreign = await createProject({ userId: other.users.x.id }, { spaceId: other.space.id, name: "F" });
    await expect(
      createProject(
        { userId: users.owner.id },
        { spaceId: space.id, name: "P", copyStatusesFromProjectId: foreign.projectId },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects non-members, empty names and bad colors", async () => {
    const { space, users } = await makeSpace({ owner: "OWNER" });
    const outsider = await makeUser();
    await expect(createProject({ userId: outsider.id }, { spaceId: space.id, name: "P" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const ctx = { userId: users.owner.id };
    await expect(createProject(ctx, { spaceId: space.id, name: " " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createProject(ctx, { spaceId: space.id, name: "P", color: "red" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});
