import { beforeEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { changeRole, leaveSpace, listMembers, removeMember, renameSpace } from "@/server/services/spaces";
import { createProject } from "@/server/services/projects";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

type Space = Awaited<ReturnType<typeof setup>>;
let s: Space;

async function setup() {
  return makeSpace({ owner: "OWNER", admin: "ADMIN", admin2: "ADMIN", member: "MEMBER", member2: "MEMBER" });
}
const as = (userId: string) => ({ userId });
const role = async (spaceId: string, userId: string) =>
  (await db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } }))?.role ?? null;

/** A task in the space assigned to `userIds`. */
async function assignedTask(spaceId: string, creatorId: string, userIds: string[]) {
  const { projectId, firstListId } = await createProject(as(creatorId), { spaceId, name: "P" });
  const status = await db.status.findFirstOrThrow({ where: { projectId } });
  return db.task.create({
    data: {
      spaceId,
      projectId,
      homeListId: firstListId,
      statusId: status.id,
      title: "T",
      position: "a0",
      createdById: creatorId,
      assignees: { create: userIds.map((userId) => ({ userId })) },
    },
  });
}

beforeEach(async () => {
  s = await setup();
});

describe("listMembers / renameSpace", () => {
  it("lists every member with email and role, oldest first", async () => {
    const members = await listMembers(as(s.users.member.id), { spaceId: s.space.id });
    // makeSpace inserts everyone at once, so joinedAt ties and the name tiebreak decides.
    expect(members.map((m) => m.name)).toEqual(["admin", "admin2", "member", "member2", "owner"]);
    expect(members.find((m) => m.id === s.users.owner.id)).toMatchObject({
      email: s.users.owner.email,
      role: "OWNER",
      image: null,
    });
  });

  it("hides the member list from non-members", async () => {
    const outsider = await makeUser();
    await expect(listMembers(as(outsider.id), { spaceId: s.space.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets only the Owner rename the space", async () => {
    await renameSpace(as(s.users.owner.id), { spaceId: s.space.id, name: " Renamed " });
    expect((await db.space.findUniqueOrThrow({ where: { id: s.space.id } })).name).toBe("Renamed");
    await expect(renameSpace(as(s.users.admin.id), { spaceId: s.space.id, name: "X" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("changeRole", () => {
  it("lets the Owner change roles, and nobody else", async () => {
    await changeRole(as(s.users.owner.id), { spaceId: s.space.id, userId: s.users.member.id, role: "ADMIN" });
    expect(await role(s.space.id, s.users.member.id)).toBe("ADMIN");
    await expect(
      changeRole(as(s.users.admin.id), { spaceId: s.space.id, userId: s.users.member2.id, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never demotes the last Owner", async () => {
    await expect(
      changeRole(as(s.users.owner.id), { spaceId: s.space.id, userId: s.users.owner.id, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await role(s.space.id, s.users.owner.id)).toBe("OWNER");
  });

  it("transfers ownership by promoting someone else first", async () => {
    const ctx = as(s.users.owner.id);
    await changeRole(ctx, { spaceId: s.space.id, userId: s.users.admin.id, role: "OWNER" });
    await changeRole(ctx, { spaceId: s.space.id, userId: s.users.owner.id, role: "MEMBER" });
    expect(await role(s.space.id, s.users.admin.id)).toBe("OWNER");
    expect(await role(s.space.id, s.users.owner.id)).toBe("MEMBER");
  });

  it("returns NOT_FOUND for a user who isn't a member", async () => {
    const outsider = await makeUser();
    await expect(
      changeRole(as(s.users.owner.id), { spaceId: s.space.id, userId: outsider.id, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("keeps an Owner when two Owners demote each other at the same time", async () => {
    await changeRole(as(s.users.owner.id), { spaceId: s.space.id, userId: s.users.admin.id, role: "OWNER" });
    const [a, b] = [s.users.owner.id, s.users.admin.id];
    const results = await Promise.allSettled([
      changeRole(as(a), { spaceId: s.space.id, userId: b, role: "MEMBER" }),
      changeRole(as(b), { spaceId: s.space.id, userId: a, role: "MEMBER" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.spaceMember.count({ where: { spaceId: s.space.id, role: "OWNER" } })).toBe(1);
  });
});

describe("removeMember", () => {
  it("lets an Admin remove a Member, unassigning them and logging ASSIGNEE_REMOVED", async () => {
    const task = await assignedTask(s.space.id, s.users.owner.id, [s.users.member.id, s.users.member2.id]);
    await removeMember(as(s.users.admin.id), { spaceId: s.space.id, userId: s.users.member.id });

    expect(await role(s.space.id, s.users.member.id)).toBeNull();
    const assignees = await db.taskAssignee.findMany({ where: { taskId: task.id } });
    expect(assignees.map((a) => a.userId)).toEqual([s.users.member2.id]);
    const activity = await db.activity.findMany({ where: { taskId: task.id } });
    expect(activity).toEqual([
      expect.objectContaining({
        type: "ASSIGNEE_REMOVED",
        actorId: s.users.admin.id,
        spaceId: s.space.id,
        payload: { userId: s.users.member.id },
      }),
    ]);
  });

  it("only lets an Owner remove Admins", async () => {
    await expect(
      removeMember(as(s.users.admin.id), { spaceId: s.space.id, userId: s.users.admin2.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await removeMember(as(s.users.owner.id), { spaceId: s.space.id, userId: s.users.admin2.id });
    expect(await role(s.space.id, s.users.admin2.id)).toBeNull();
  });

  it("doesn't let Members remove anyone, or anyone remove themselves", async () => {
    await expect(
      removeMember(as(s.users.member.id), { spaceId: s.space.id, userId: s.users.member2.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      removeMember(as(s.users.admin.id), { spaceId: s.space.id, userId: s.users.admin.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("leaves assignments in other spaces alone", async () => {
    const other = await makeSpace({ o: "OWNER" });
    await db.spaceMember.create({ data: { spaceId: other.space.id, userId: s.users.member.id } });
    const elsewhere = await assignedTask(other.space.id, other.users.o.id, [s.users.member.id]);
    await removeMember(as(s.users.owner.id), { spaceId: s.space.id, userId: s.users.member.id });
    expect(await db.taskAssignee.count({ where: { taskId: elsewhere.id } })).toBe(1);
  });
});

describe("leaveSpace", () => {
  it("lets a Member leave, unassigning them", async () => {
    const task = await assignedTask(s.space.id, s.users.owner.id, [s.users.member.id]);
    await leaveSpace(as(s.users.member.id), { spaceId: s.space.id });
    expect(await role(s.space.id, s.users.member.id)).toBeNull();
    expect(await db.taskAssignee.count({ where: { taskId: task.id } })).toBe(0);
    expect(await db.activity.count({ where: { taskId: task.id, type: "ASSIGNEE_REMOVED" } })).toBe(1);
  });

  it("stops the last Owner leaving, but not an Owner with a co-Owner", async () => {
    await expect(leaveSpace(as(s.users.owner.id), { spaceId: s.space.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await changeRole(as(s.users.owner.id), { spaceId: s.space.id, userId: s.users.admin.id, role: "OWNER" });
    await leaveSpace(as(s.users.owner.id), { spaceId: s.space.id });
    expect(await role(s.space.id, s.users.owner.id)).toBeNull();
  });
});
