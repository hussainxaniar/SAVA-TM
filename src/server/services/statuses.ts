import { Prisma, type Status, type StatusCategory } from "@prisma/client";
import { isStatusIconKey } from "@/lib/list-icons";
import { positionAfter } from "@/lib/position";
import { db } from "../db";
import { AppError } from "../errors";
import { PERMISSIONS, requireMember, requireRole, spaceIdOfProject, spaceIdOfStatus } from "../guards";
import { logActivities } from "./activity";
import { positionForMove, type MoveTarget } from "./ordering";
import type { Ctx, StatusDTO } from "./types";
import { checkColor, cleanName, serializableTransaction } from "./util";

// Section 6.1 / 8.3. Editing statuses is Owner/Admin (7.3); any member can read them.

const NAME_MAX = 40;

export function toStatusDTO(s: Status): StatusDTO {
  return { id: s.id, name: s.name, color: s.color, category: s.category, icon: s.icon, position: s.position };
}

/** Section 8.3. Statuses of a project in position order. */
export async function listStatuses(ctx: Ctx, input: { projectId: string }): Promise<StatusDTO[]> {
  await requireMember(ctx.userId, await spaceIdOfProject(input.projectId));
  const statuses = await db.status.findMany({ where: { projectId: input.projectId }, orderBy: { position: "asc" } });
  return statuses.map(toStatusDTO);
}

/** Section 8.3. ADMIN. Appended at the end; names are unique per project, ignoring case (6.1.5). */
export async function createStatus(
  ctx: Ctx,
  input: { projectId: string; name: string; color: string; category: StatusCategory; icon?: string | null },
): Promise<StatusDTO> {
  await requireRole(ctx.userId, await spaceIdOfProject(input.projectId), PERMISSIONS.editStatuses);
  const name = cleanName(input.name, "Status name", NAME_MAX);
  checkColor(input.color);
  const icon = checkStatusIcon(input.icon, input.category);
  return uniqueNameGuard(name, () =>
    db.$transaction(async (tx) => {
      await assertNameFree(tx, input.projectId, name);
      const last = await tx.status.findFirst({
        where: { projectId: input.projectId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const status = await tx.status.create({
        data: {
          projectId: input.projectId,
          name,
          color: input.color,
          category: input.category,
          icon,
          position: positionAfter(last?.position),
        },
      });
      return toStatusDTO(status);
    }),
  );
}

/**
 * Section 8.3 [A]. ADMIN. A project always keeps at least one TODO and one DONE status
 * (6.1.3). Moving a status into or out of DONE also sets or clears `completedAt` on its
 * tasks, so "completed" always matches the status category (6.2.3).
 */
export async function updateStatus(
  ctx: Ctx,
  input: { statusId: string; name?: string; color?: string; category?: StatusCategory; icon?: string | null },
): Promise<void> {
  await requireRole(ctx.userId, await spaceIdOfStatus(input.statusId), PERMISSIONS.editStatuses);
  const name = input.name === undefined ? undefined : cleanName(input.name, "Status name", NAME_MAX);
  if (input.color !== undefined) checkColor(input.color);

  await uniqueNameGuard(name ?? "", () =>
    serializableTransaction(async (tx) => {
      const status = await tx.status.findUniqueOrThrow({ where: { id: input.statusId } });
      if (name !== undefined && name !== status.name) await assertNameFree(tx, status.projectId, name, status.id);

      const category = input.category ?? status.category;
      // Only ACTIVE statuses have a choosable icon; leaving ACTIVE clears it.
      const icon = category !== "ACTIVE" ? null : input.icon === undefined ? undefined : checkStatusIcon(input.icon, category);
      if (category !== status.category) {
        const others = await tx.status.findMany({
          where: { projectId: status.projectId, id: { not: status.id } },
          select: { category: true },
        });
        assertCoverage([...others.map((s) => s.category), category]);
      }

      await tx.status.update({
        where: { id: status.id },
        data: { name, color: input.color, category: input.category, icon },
      });
      if (category !== status.category) await syncCompletion(tx, { statusId: status.id }, status.category, category);
    }, "Someone else changed these statuses at the same time. Try again."),
  );
}

/** Section 8.3. ADMIN. See MoveTarget for beforeId/afterId. */
export async function reorderStatus(ctx: Ctx, input: { statusId: string } & MoveTarget): Promise<void> {
  await requireRole(ctx.userId, await spaceIdOfStatus(input.statusId), PERMISSIONS.editStatuses);
  await db.$transaction(async (tx) => {
    const { projectId } = await tx.status.findUniqueOrThrow({ where: { id: input.statusId }, select: { projectId: true } });
    const siblings = await tx.status.findMany({ where: { projectId }, select: { id: true, position: true } });
    const position = positionForMove(siblings, input.statusId, input);
    await tx.status.update({ where: { id: input.statusId }, data: { position } });
  });
}

/**
 * Section 8.3 [A] / 6.1.4. ADMIN. Every task on the status (soft-deleted ones included,
 * since they still reference it) moves to `replacementStatusId` from the same project,
 * each logging STATUS_CHANGED { from, to }. The TODO/DONE minimum still applies.
 */
export async function deleteStatus(ctx: Ctx, input: { statusId: string; replacementStatusId: string }): Promise<void> {
  await requireRole(ctx.userId, await spaceIdOfStatus(input.statusId), PERMISSIONS.editStatuses);
  if (input.replacementStatusId === input.statusId) {
    throw new AppError("VALIDATION", "Pick a different status to move its tasks to");
  }

  await serializableTransaction(async (tx) => {
    const [status, replacement] = await Promise.all(
      [input.statusId, input.replacementStatusId].map((id) => tx.status.findUnique({ where: { id } })),
    );
    if (!status) throw new AppError("NOT_FOUND", "Status not found");
    if (!replacement || replacement.projectId !== status.projectId) {
      throw new AppError("VALIDATION", "Pick a status from the same project to move its tasks to");
    }
    const others = await tx.status.findMany({
      where: { projectId: status.projectId, id: { not: status.id } },
      select: { category: true },
    });
    assertCoverage(others.map((s) => s.category));

    const tasks = await tx.task.findMany({ where: { statusId: status.id }, select: { id: true, spaceId: true } });
    await tx.task.updateMany({ where: { statusId: status.id }, data: { statusId: replacement.id } });
    await syncCompletion(tx, { id: { in: tasks.map((t) => t.id) } }, status.category, replacement.category);
    await logActivities(
      tx,
      tasks.map((t) => ({
        spaceId: t.spaceId,
        taskId: t.id,
        actorId: ctx.userId,
        type: "STATUS_CHANGED" as const,
        payload: { from: status.id, to: replacement.id },
      })),
    );
    await tx.status.delete({ where: { id: status.id } });
  }, "Someone else changed these statuses at the same time. Try again.");
}

// ---------- helpers ----------

function assertCoverage(categories: StatusCategory[]) {
  if (!categories.includes("TODO")) {
    throw new AppError("VALIDATION", "A project needs at least one To do status. Add or change another one first.");
  }
  if (!categories.includes("DONE")) {
    throw new AppError("VALIDATION", "A project needs at least one Done status. Add or change another one first.");
  }
}

async function assertNameFree(tx: Prisma.TransactionClient, projectId: string, name: string, exceptId?: string) {
  const clash = await tx.status.findFirst({
    where: { projectId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new AppError("VALIDATION", `There's already a status called "${name}"`);
}

/** Maps the DB's case-sensitive unique (projectId, name) to the same message as the service check. */
async function uniqueNameGuard<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("VALIDATION", `There's already a status called "${name}"`);
    }
    throw e;
  }
}

/** Keeps completedAt in step with the category when tasks' effective status category changes (6.2.3). */
async function syncCompletion(
  tx: Prisma.TransactionClient,
  where: Prisma.TaskWhereInput,
  from: StatusCategory,
  to: StatusCategory,
) {
  if (from !== "DONE" && to === "DONE") {
    await tx.task.updateMany({ where: { ...where, completedAt: null }, data: { completedAt: new Date() } });
  } else if (from === "DONE" && to !== "DONE") {
    await tx.task.updateMany({ where: { ...where, completedAt: { not: null } }, data: { completedAt: null } });
  }
}

/** A status icon is only for ACTIVE statuses and must be one of the known keys; null/undefined = by position. */
function checkStatusIcon(icon: string | null | undefined, category: StatusCategory): string | null {
  if (icon === null || icon === undefined) return null;
  if (category !== "ACTIVE") throw new AppError("VALIDATION", "Only In-progress statuses can pick an icon");
  if (!isStatusIconKey(icon)) throw new AppError("VALIDATION", "Pick one of the status icons");
  return icon;
}
