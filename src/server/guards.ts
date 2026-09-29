import type { SpaceMember, SpaceRole } from "@prisma/client";
import { db } from "./db";
import { AppError } from "./errors";
import { getSessionUser, type SessionUser } from "./auth";

// Section 7.4. Services resolve the spaceId of whatever they touch FROM THE DATABASE
// (resolvers below), then call requireMember / requireRole.
//
// Error codes: a non-member gets NOT_FOUND for everything in a space, exactly like a
// missing entity, so existence never leaks. A member whose role is too low gets
// FORBIDDEN (they can already see the entity, so nothing leaks).

const RANK: Record<SpaceRole, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };

export type MinRole = Exclude<SpaceRole, "MEMBER">;

/** Minimum role per gated action — the "No" cells of the Section 7.3 matrix. */
export const PERMISSIONS = {
  editStatuses: "ADMIN",
  deleteList: "ADMIN",
  archiveProject: "ADMIN",
  manageInvites: "ADMIN",
  removeMember: "ADMIN",
  deleteOthersComments: "ADMIN",
  changeRoles: "OWNER",
  removeAdmin: "OWNER",
  renameSpace: "OWNER",
  deleteSpace: "OWNER",
} as const satisfies Record<string, MinRole>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(role: SpaceRole, min: SpaceRole): boolean {
  return RANK[role] >= RANK[min];
}

export function can(role: SpaceRole, permission: Permission): boolean {
  return hasRole(role, PERMISSIONS[permission]);
}

export function requireUser(): Promise<SessionUser> {
  return getSessionUser();
}

export async function requireMember(userId: string, spaceId: string): Promise<SpaceMember> {
  const member = await db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
  if (!member) throw notFound("Space");
  return member;
}

export async function requireRole(userId: string, spaceId: string, min: MinRole): Promise<SpaceMember> {
  const member = await requireMember(userId, spaceId);
  if (!hasRole(member.role, min)) {
    throw new AppError("FORBIDDEN", `This needs the ${min === "OWNER" ? "Owner" : "Admin"} role`);
  }
  return member;
}

// ---------- Resolvers: entity id → spaceId, NOT_FOUND when missing ----------
// They don't filter archived or soft-deleted rows; services decide that (restoreTask
// must resolve a deleted task).

export async function spaceIdOfProject(projectId: string): Promise<string> {
  const row = await db.project.findUnique({ where: { id: projectId }, select: { spaceId: true } });
  if (!row) throw notFound("Project");
  return row.spaceId;
}

export async function spaceIdOfStatus(statusId: string): Promise<string> {
  const row = await db.status.findUnique({ where: { id: statusId }, select: { project: { select: { spaceId: true } } } });
  if (!row) throw notFound("Status");
  return row.project.spaceId;
}

export async function spaceIdOfList(listId: string): Promise<string> {
  const row = await db.list.findUnique({ where: { id: listId }, select: { project: { select: { spaceId: true } } } });
  if (!row) throw notFound("List");
  return row.project.spaceId;
}

export async function spaceIdOfTask(taskId: string): Promise<string> {
  const row = await db.task.findUnique({ where: { id: taskId }, select: { spaceId: true } });
  if (!row) throw notFound("Task");
  return row.spaceId;
}

export async function spaceIdOfComment(commentId: string): Promise<string> {
  const row = await db.comment.findUnique({ where: { id: commentId }, select: { task: { select: { spaceId: true } } } });
  if (!row) throw notFound("Comment");
  return row.task.spaceId;
}

export async function spaceIdOfDoc(docId: string): Promise<string> {
  const row = await db.doc.findUnique({ where: { id: docId }, select: { spaceId: true } });
  if (!row) throw notFound("Doc");
  return row.spaceId;
}

export async function spaceIdOfDocPage(pageId: string): Promise<string> {
  const row = await db.docPage.findUnique({ where: { id: pageId }, select: { doc: { select: { spaceId: true } } } });
  if (!row) throw notFound("Page");
  return row.doc.spaceId;
}

export async function spaceIdOfInvite(inviteId: string): Promise<string> {
  const row = await db.invite.findUnique({ where: { id: inviteId }, select: { spaceId: true } });
  if (!row) throw notFound("Invite");
  return row.spaceId;
}

function notFound(what: string) {
  return new AppError("NOT_FOUND", `${what} not found`);
}
