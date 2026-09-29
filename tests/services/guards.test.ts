import { beforeAll, describe, expect, it } from "vitest";
import type { SpaceRole } from "@prisma/client";
import { db } from "@/server/db";
import {
  can,
  PERMISSIONS,
  requireMember,
  requireRole,
  spaceIdOfComment,
  spaceIdOfDoc,
  spaceIdOfDocPage,
  spaceIdOfInvite,
  spaceIdOfList,
  spaceIdOfProject,
  spaceIdOfStatus,
  spaceIdOfTask,
  type Permission,
} from "@/server/guards";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

// Section 7.3, written out independently of PERMISSIONS so the test checks the code
// against the spec rather than against itself. [Owner, Admin, Member]
const MATRIX: Record<Permission, [boolean, boolean, boolean]> = {
  editStatuses: [true, true, false],
  deleteList: [true, true, false],
  archiveProject: [true, true, false],
  manageInvites: [true, true, false],
  removeMember: [true, true, false],
  deleteOthersComments: [true, true, false],
  changeRoles: [true, false, false],
  removeAdmin: [true, false, false],
  renameSpace: [true, false, false],
  deleteSpace: [true, false, false],
};
const ROLES: SpaceRole[] = ["OWNER", "ADMIN", "MEMBER"];

let spaceId: string;
let otherSpaceId: string;
let users: Record<"owner" | "admin" | "member", { id: string }>;
let outsider: { id: string };
let ids: Record<"project" | "status" | "list" | "task" | "comment" | "doc" | "page" | "invite", string>;

beforeAll(async () => {
  await resetDb();
  const made = await makeSpace({ owner: "OWNER", admin: "ADMIN", member: "MEMBER" });
  spaceId = made.space.id;
  users = made.users;
  outsider = await makeUser("outsider");
  otherSpaceId = (await makeSpace({ other: "OWNER" })).space.id;

  const project = await db.project.create({
    data: {
      spaceId,
      name: "P",
      position: "a0",
      statuses: { create: { name: "To do", color: "#000", category: "TODO", position: "a0" } },
      lists: { create: { name: "General", position: "a0" } },
    },
    include: { statuses: true, lists: true },
  });
  const task = await db.task.create({
    data: {
      spaceId,
      projectId: project.id,
      homeListId: project.lists[0].id,
      statusId: project.statuses[0].id,
      title: "T",
      position: "a0",
      createdById: users.owner.id,
    },
  });
  const comment = await db.comment.create({
    data: { taskId: task.id, authorId: users.member.id, body: {}, bodyText: "" },
  });
  const doc = await db.doc.create({
    data: { spaceId, projectId: project.id, title: "D", position: "a0", createdById: users.owner.id },
  });
  const page = await db.docPage.create({
    data: { docId: doc.id, content: {}, position: "a0", createdById: users.owner.id, updatedById: users.owner.id },
  });
  const invite = await db.invite.create({
    data: { spaceId, token: "tok", createdById: users.owner.id, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  ids = {
    project: project.id,
    status: project.statuses[0].id,
    list: project.lists[0].id,
    task: task.id,
    comment: comment.id,
    doc: doc.id,
    page: page.id,
    invite: invite.id,
  };
});

describe("requireMember", () => {
  it("returns the membership for every role", async () => {
    for (const [label, role] of [["owner", "OWNER"], ["admin", "ADMIN"], ["member", "MEMBER"]] as const) {
      await expect(requireMember(users[label].id, spaceId)).resolves.toMatchObject({ spaceId, role });
    }
  });

  it("gives a non-member NOT_FOUND, same as a missing space", async () => {
    await expect(requireMember(outsider.id, spaceId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requireMember(users.owner.id, otherSpaceId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requireMember(users.owner.id, "no-such-space")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("requireRole follows the Section 7.3 matrix", () => {
  const byRole = { OWNER: "owner", ADMIN: "admin", MEMBER: "member" } as const;

  for (const [permission, allowed] of Object.entries(MATRIX) as [Permission, boolean[]][]) {
    ROLES.forEach((role, i) => {
      it(`${permission}: ${role} → ${allowed[i] ? "allowed" : "FORBIDDEN"}`, async () => {
        const call = requireRole(users[byRole[role]].id, spaceId, PERMISSIONS[permission]);
        if (allowed[i]) await expect(call).resolves.toMatchObject({ role });
        else await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(can(role, permission)).toBe(allowed[i]);
      });
    });
  }

  it("covers every gated action in the matrix", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  it("gives a non-member NOT_FOUND, not FORBIDDEN", async () => {
    await expect(requireRole(outsider.id, spaceId, "ADMIN")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requireRole(outsider.id, spaceId, "OWNER")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("spaceId resolvers", () => {
  const resolvers = {
    project: spaceIdOfProject,
    status: spaceIdOfStatus,
    list: spaceIdOfList,
    task: spaceIdOfTask,
    comment: spaceIdOfComment,
    doc: spaceIdOfDoc,
    page: spaceIdOfDocPage,
    invite: spaceIdOfInvite,
  } as const;

  for (const [entity, resolve] of Object.entries(resolvers)) {
    it(`${entity}: resolves the owning space, NOT_FOUND when missing`, async () => {
      await expect(resolve(ids[entity as keyof typeof ids])).resolves.toBe(spaceId);
      await expect(resolve("missing-id")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  }

  it("resolve + requireMember hides another space's task from an outsider", async () => {
    const check = async () => requireMember(outsider.id, await spaceIdOfTask(ids.task));
    await expect(check()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
