import { randomBytes } from "node:crypto";
import { Prisma, type Invite, type SpaceRole } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../errors";
import { hasRole, PERMISSIONS, requireMember, requireRole, spaceIdOfInvite } from "../guards";
import { DEFAULT_PROJECT_NAME } from "../defaults";
import { logActivities } from "./activity";
import { insertProject } from "./projects";
import type {
  Ctx,
  InviteDTO,
  InviteInfoDTO,
  InviteProblem,
  InviteRole,
  InviteStatus,
  MemberDTO,
  SpaceSummaryDTO,
} from "./types";
import { cleanName, serializableTransaction } from "./util";

/**
 * Section 8.2 [A] / 7.2.1. The creator becomes OWNER, and the space starts with a
 * "Getting started" project (default statuses, list "General"). Any signed-in user may
 * create a space.
 */
export async function createSpace(ctx: Ctx, input: { name: string }): Promise<{ spaceId: string }> {
  const name = cleanName(input.name, "Space name");
  return db.$transaction(async (tx) => {
    const space = await tx.space.create({
      data: { name, createdById: ctx.userId, members: { create: { userId: ctx.userId, role: "OWNER" } } },
      select: { id: true },
    });
    await insertProject(tx, { spaceId: space.id, name: DEFAULT_PROJECT_NAME });
    return { spaceId: space.id };
  });
}

/** Section 8.2. The caller's spaces, oldest membership first. */
export async function listMySpaces(ctx: Ctx): Promise<SpaceSummaryDTO[]> {
  const rows = await db.spaceMember.findMany({
    where: { userId: ctx.userId },
    orderBy: { joinedAt: "asc" },
    select: { role: true, space: { select: { id: true, name: true, icon: true } } },
  });
  return rows.map(({ role, space }) => ({ ...space, role }));
}

/**
 * Where to land when opening a space: its first active project's first active list,
 * or null when the space has no active project/list.
 */
export async function getSpaceLanding(
  ctx: Ctx,
  input: { spaceId: string },
): Promise<{ projectId: string; listId: string } | null> {
  await requireMember(ctx.userId, input.spaceId);
  const project = await db.project.findFirst({
    where: { spaceId: input.spaceId, archivedAt: null, lists: { some: { archivedAt: null } } },
    orderBy: { position: "asc" },
    select: {
      id: true,
      lists: { where: { archivedAt: null }, orderBy: { position: "asc" }, take: 1, select: { id: true } },
    },
  });
  if (!project) return null;
  return { projectId: project.id, listId: project.lists[0].id };
}

/** Section 8.2. OWNER only. */
export async function renameSpace(ctx: Ctx, input: { spaceId: string; name: string }): Promise<void> {
  await requireRole(ctx.userId, input.spaceId, PERMISSIONS.renameSpace);
  const name = cleanName(input.name, "Space name");
  await db.space.update({ where: { id: input.spaceId }, data: { name } });
}

// ---------- Members ----------

/** Section 8.2. Any member can see the member list, oldest first. */
export async function listMembers(ctx: Ctx, input: { spaceId: string }): Promise<MemberDTO[]> {
  await requireMember(ctx.userId, input.spaceId);
  const rows = await db.spaceMember.findMany({
    where: { spaceId: input.spaceId },
    orderBy: [{ joinedAt: "asc" }, { user: { name: "asc" } }],
    select: { role: true, joinedAt: true, user: { select: { id: true, name: true, email: true, image: true } } },
  });
  return rows.map(({ role, joinedAt, user }) => ({ ...user, role, joinedAt: joinedAt.toISOString() }));
}

const LAST_OWNER = "A space needs at least one Owner. Make someone else Owner first.";

/** Section 8.2 [A]. OWNER only; the last Owner can't be demoted (7.2.5). */
export async function changeRole(
  ctx: Ctx,
  input: { spaceId: string; userId: string; role: SpaceRole },
): Promise<void> {
  await requireRole(ctx.userId, input.spaceId, PERMISSIONS.changeRoles);
  await ownerSafeTransaction(async (tx) => {
    // Re-check the actor inside the transaction: they may have been demoted concurrently.
    const [actor, target] = await Promise.all(
      [ctx.userId, input.userId].map((userId) =>
        tx.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: input.spaceId, userId } } }),
      ),
    );
    if (!actor || !hasRole(actor.role, PERMISSIONS.changeRoles)) {
      throw new AppError("FORBIDDEN", "This needs the Owner role");
    }
    if (!target) throw new AppError("NOT_FOUND", "Member not found");
    if (target.role === input.role) return;
    if (target.role === "OWNER" && (await countOwners(tx, input.spaceId)) <= 1) {
      throw new AppError("VALIDATION", LAST_OWNER);
    }
    await tx.spaceMember.update({
      where: { spaceId_userId: { spaceId: input.spaceId, userId: input.userId } },
      data: { role: input.role },
    });
  });
}

/**
 * Section 8.2 [A]. Owner/Admin remove Members; only an Owner removes Admins or Owners
 * (7.3). You can't remove yourself (use leaveSpace). Their task assignments in the space
 * are removed, logging ASSIGNEE_REMOVED per task (6.8.2).
 */
export async function removeMember(ctx: Ctx, input: { spaceId: string; userId: string }): Promise<void> {
  await requireRole(ctx.userId, input.spaceId, PERMISSIONS.removeMember);
  if (input.userId === ctx.userId) throw new AppError("VALIDATION", "To leave the space, use Leave space");
  await ownerSafeTransaction(async (tx) => {
    const [actor, target] = await Promise.all(
      [ctx.userId, input.userId].map((userId) =>
        tx.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: input.spaceId, userId } } }),
      ),
    );
    if (!actor || !hasRole(actor.role, PERMISSIONS.removeMember)) {
      throw new AppError("FORBIDDEN", "This needs the Admin role");
    }
    if (!target) throw new AppError("NOT_FOUND", "Member not found");
    if (target.role !== "MEMBER" && !hasRole(actor.role, PERMISSIONS.removeAdmin)) {
      throw new AppError("FORBIDDEN", "Only an Owner can remove Admins and Owners");
    }
    await removeMembership(tx, input.spaceId, input.userId, ctx.userId);
  });
}

/** Section 8.2 [A]. The last Owner can't leave (7.2.5). */
export async function leaveSpace(ctx: Ctx, input: { spaceId: string }): Promise<void> {
  await requireMember(ctx.userId, input.spaceId);
  await ownerSafeTransaction(async (tx) => {
    const me = await tx.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: input.spaceId, userId: ctx.userId } },
    });
    if (!me) throw new AppError("NOT_FOUND", "Space not found");
    if (me.role === "OWNER" && (await countOwners(tx, input.spaceId)) <= 1) {
      throw new AppError("VALIDATION", "You're the only Owner. Make someone else Owner before leaving.");
    }
    await removeMembership(tx, input.spaceId, ctx.userId, ctx.userId);
  });
}

async function removeMembership(tx: Prisma.TransactionClient, spaceId: string, userId: string, actorId: string) {
  const where = { userId, task: { spaceId } };
  const assignments = await tx.taskAssignee.findMany({ where, select: { taskId: true } });
  await tx.taskAssignee.deleteMany({ where });
  await logActivities(
    tx,
    assignments.map(({ taskId }) => ({ spaceId, taskId, actorId, type: "ASSIGNEE_REMOVED", payload: { userId } })),
  );
  await tx.spaceMember.delete({ where: { spaceId_userId: { spaceId, userId } } });
}

function countOwners(tx: Prisma.TransactionClient, spaceId: string) {
  return tx.spaceMember.count({ where: { spaceId, role: "OWNER" } });
}

function ownerSafeTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return serializableTransaction(fn, "Someone else changed this space at the same time. Try again.");
}

// ---------- Invites ----------

export const INVITE_EXPIRY_DAYS = [1, 7, 30] as const;
const MAX_INVITE_USES = 1000;

export const INVITE_MESSAGES: Record<InviteProblem, string> = {
  NOT_FOUND: "This invite link isn't valid. Ask for a new one.",
  EXPIRED: "This invite link has expired. Ask for a new one.",
  REVOKED: "This invite link was revoked. Ask for a new one.",
  USED_UP: "This invite link has reached its maximum number of uses. Ask for a new one.",
};

function inviteUrl(token: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/invite/${token}`;
}

function inviteProblem(invite: Invite, now = new Date()): Exclude<InviteProblem, "NOT_FOUND"> | null {
  if (invite.revokedAt) return "REVOKED";
  if (invite.expiresAt <= now) return "EXPIRED";
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return "USED_UP";
  return null;
}

function toInviteDTO(invite: Invite): InviteDTO {
  const problem = inviteProblem(invite);
  const status: InviteStatus = problem === "EXPIRED" ? "EXPIRED" : problem === "USED_UP" ? "USED_UP" : "ACTIVE";
  return {
    id: invite.id,
    url: inviteUrl(invite.token),
    role: invite.role as InviteRole,
    expiresAt: invite.expiresAt.toISOString(),
    uses: invite.uses,
    maxUses: invite.maxUses,
    createdAt: invite.createdAt.toISOString(),
    status,
  };
}

/** Section 8.2 [A]. ADMIN. Role is Admin or Member (never Owner); expiry 1, 7 or 30 days. */
export async function createInvite(
  ctx: Ctx,
  input: { spaceId: string; role: SpaceRole; expiresInDays: number; maxUses?: number | null },
): Promise<{ url: string; invite: InviteDTO }> {
  await requireRole(ctx.userId, input.spaceId, PERMISSIONS.manageInvites);
  if (input.role === "OWNER") throw new AppError("VALIDATION", "Invites can't make someone an Owner");
  if (!(INVITE_EXPIRY_DAYS as readonly number[]).includes(input.expiresInDays)) {
    throw new AppError("VALIDATION", "Expiry must be 1, 7 or 30 days");
  }
  const maxUses = input.maxUses ?? null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_INVITE_USES)) {
    throw new AppError("VALIDATION", `Max uses must be a whole number from 1 to ${MAX_INVITE_USES}`);
  }
  const invite = await db.invite.create({
    data: {
      spaceId: input.spaceId,
      token: randomBytes(32).toString("base64url"),
      role: input.role,
      createdById: ctx.userId,
      expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000),
      maxUses,
    },
  });
  const dto = toInviteDTO(invite);
  return { url: dto.url, invite: dto };
}

/** ADMIN. Invites for Space settings, newest first; revoked ones are hidden. */
export async function listInvites(ctx: Ctx, input: { spaceId: string }): Promise<InviteDTO[]> {
  await requireRole(ctx.userId, input.spaceId, PERMISSIONS.manageInvites);
  const invites = await db.invite.findMany({
    where: { spaceId: input.spaceId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return invites.map(toInviteDTO);
}

/** Section 8.2. ADMIN. Idempotent. */
export async function revokeInvite(ctx: Ctx, input: { inviteId: string }): Promise<void> {
  const spaceId = await spaceIdOfInvite(input.inviteId);
  await requireRole(ctx.userId, spaceId, PERMISSIONS.manageInvites);
  await db.invite.updateMany({ where: { id: input.inviteId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Section 8.2. Works signed out (`ctx` null): the token itself is the secret, so anyone
 * holding it may see the space name and role.
 */
export async function getInvite(ctx: Ctx | null, input: { token: string }): Promise<InviteInfoDTO> {
  const invite = await db.invite.findUnique({
    where: { token: input.token },
    include: { space: { select: { name: true } } },
  });
  if (!invite) return { valid: false, reason: "NOT_FOUND", spaceName: null, memberSpaceId: null };

  const isMember =
    ctx !== null &&
    (await db.spaceMember.count({ where: { spaceId: invite.spaceId, userId: ctx.userId } })) > 0;
  const memberSpaceId = isMember ? invite.spaceId : null;
  const problem = inviteProblem(invite);
  if (problem) return { valid: false, reason: problem, spaceName: invite.space.name, memberSpaceId };
  return { valid: true, spaceName: invite.space.name, role: invite.role as InviteRole, memberSpaceId };
}

/**
 * Section 8.2 [A]. Joins the space with the invite's role. Already a member → no-op (7.2.4).
 * `uses` is incremented with a conditional update, so concurrent accepts can't exceed maxUses.
 */
export async function acceptInvite(ctx: Ctx, input: { token: string }): Promise<{ spaceId: string }> {
  const invite = await db.invite.findUnique({ where: { token: input.token } });
  if (!invite) throw new AppError("NOT_FOUND", INVITE_MESSAGES.NOT_FOUND);
  const { spaceId } = invite;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId: ctx.userId } } });
      if (existing) return;

      const problem = inviteProblem(invite);
      if (problem) throw new AppError("VALIDATION", INVITE_MESSAGES[problem]);

      const claimed = await tx.invite.updateMany({
        where: {
          id: invite.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          OR: [{ maxUses: null }, { uses: { lt: db.invite.fields.maxUses } }],
        },
        data: { uses: { increment: 1 } },
      });
      if (claimed.count === 0) {
        const fresh = await tx.invite.findUniqueOrThrow({ where: { id: invite.id } });
        throw new AppError("VALIDATION", INVITE_MESSAGES[inviteProblem(fresh) ?? "USED_UP"]);
      }
      await tx.spaceMember.create({ data: { spaceId, userId: ctx.userId, role: invite.role } });
    });
  } catch (e) {
    // A concurrent accept by the same user won the insert; they're a member either way.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { spaceId };
    throw e;
  }
  return { spaceId };
}
