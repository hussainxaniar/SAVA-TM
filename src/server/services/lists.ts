import { isListIconKey } from "@/lib/list-icons";
import type { SubtaskDisplay } from "@prisma/client";
import { positionAfter, positionsBetween } from "@/lib/position";
import { db } from "../db";
import { AppError } from "../errors";
import { PERMISSIONS, requireMember, requireRole, spaceIdOfList, spaceIdOfProject } from "../guards";
import { logActivities } from "./activity";
import { positionForMove, type MoveTarget } from "./ordering";
import type { Ctx } from "./types";
import { cleanName, serializableTransaction } from "./util";

// Section 6.3 / 8.3. Any member creates, renames and reorders lists (7.3); deleting is Owner/Admin.

/** Section 8.3. Appended after the project's last list. */
export async function createList(ctx: Ctx, input: { projectId: string; name: string; icon?: string | null }): Promise<{ listId: string }> {
  await requireMember(ctx.userId, await spaceIdOfProject(input.projectId));
  const name = cleanName(input.name, "List name");
  return db.$transaction(async (tx) => {
    const last = await tx.list.findFirst({
      where: { projectId: input.projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const list = await tx.list.create({
      data: { projectId: input.projectId, name, icon: checkListIcon(input.icon), position: positionAfter(last?.position) },
      select: { id: true },
    });
    return { listId: list.id };
  });
}

/** Section 8.3. `subtaskDisplay` is a shared per-list setting (6.3.3). */
export async function updateList(
  ctx: Ctx,
  input: { listId: string; name?: string; icon?: string | null; subtaskDisplay?: SubtaskDisplay },
): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfList(input.listId));
  const name = input.name === undefined ? undefined : cleanName(input.name, "List name");
  if (name === undefined && input.subtaskDisplay === undefined && input.icon === undefined) return;
  const icon = input.icon === undefined ? undefined : checkListIcon(input.icon);
  await db.list.update({ where: { id: input.listId }, data: { name, icon, subtaskDisplay: input.subtaskDisplay } });
}

/** Section 8.3. Among the project's active lists; see MoveTarget for beforeId/afterId. */
export async function reorderList(ctx: Ctx, input: { listId: string } & MoveTarget): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfList(input.listId));
  await db.$transaction(async (tx) => {
    const { projectId } = await tx.list.findUniqueOrThrow({ where: { id: input.listId }, select: { projectId: true } });
    const siblings = await tx.list.findMany({
      where: { projectId, archivedAt: null },
      select: { id: true, position: true },
    });
    const position = positionForMove(siblings, input.listId, input);
    await tx.list.update({ where: { id: input.listId }, data: { position } });
  });
}

/**
 * Section 8.3 [A] / 6.3.2. ADMIN. Requires `targetListId`: another active list in the same
 * project (so a project never loses its last list). Home tasks move there with their
 * subtrees; top-level ones are appended after the target's last top-level task, keeping
 * their order. A moved task's link to the target is dropped (it's home there now), and
 * links to the deleted list are removed. Logs MOVED_TO_LIST per moved top-level task and
 * REMOVED_FROM_LIST per removed link.
 */
export async function deleteList(ctx: Ctx, input: { listId: string; targetListId: string }): Promise<void> {
  await requireRole(ctx.userId, await spaceIdOfList(input.listId), PERMISSIONS.deleteList);
  if (input.targetListId === input.listId) throw new AppError("VALIDATION", "Pick another list to move its tasks to");

  await serializableTransaction(async (tx) => {
    const [list, target] = await Promise.all(
      [input.listId, input.targetListId].map((id) =>
        tx.list.findUnique({ where: { id }, select: { id: true, projectId: true, archivedAt: true } }),
      ),
    );
    if (!list) throw new AppError("NOT_FOUND", "List not found");
    if (!target || target.projectId !== list.projectId || target.archivedAt) {
      throw new AppError("VALIDATION", "Pick another list in this project to move its tasks to");
    }

    // Top-level home tasks, in order, get positions after the target's last top-level task.
    const roots = await tx.task.findMany({
      where: { homeListId: list.id, parentId: null },
      orderBy: { position: "asc" },
      select: { id: true, spaceId: true },
    });
    const lastInTarget = await tx.task.findFirst({
      where: { homeListId: target.id, parentId: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const positions = roots.length ? positionsBetween(lastInTarget?.position, null, roots.length) : [];
    for (const [i, root] of roots.entries()) {
      await tx.task.update({ where: { id: root.id }, data: { homeListId: target.id, position: positions[i] } });
    }
    // Subtasks keep their positions among siblings; only their home list changes (6.4.2).
    const movedSubtasks = await tx.task.findMany({ where: { homeListId: list.id }, select: { id: true } });
    await tx.task.updateMany({ where: { homeListId: list.id }, data: { homeListId: target.id } });

    const movedIds = [...roots.map((r) => r.id), ...movedSubtasks.map((t) => t.id)];
    await tx.taskListLink.deleteMany({ where: { listId: target.id, taskId: { in: movedIds } } });

    const links = await tx.taskListLink.findMany({
      where: { listId: list.id },
      select: { taskId: true, task: { select: { spaceId: true } } },
    });

    await logActivities(tx, [
      ...roots.map((r) => ({
        spaceId: r.spaceId,
        taskId: r.id,
        actorId: ctx.userId,
        type: "MOVED_TO_LIST" as const,
        payload: { fromListId: list.id, toListId: target.id },
      })),
      ...links.map((l) => ({
        spaceId: l.task.spaceId,
        taskId: l.taskId,
        actorId: ctx.userId,
        type: "REMOVED_FROM_LIST" as const,
        payload: { listId: list.id },
      })),
    ]);
    await tx.list.delete({ where: { id: list.id } }); // cascades its remaining links
  }, "Someone else changed these lists at the same time. Try again.");
}

/** null = the default icon; anything else must be a known key. */
function checkListIcon(icon: string | null | undefined): string | null {
  if (icon === null || icon === undefined) return null;
  if (!isListIconKey(icon)) throw new AppError("VALIDATION", "Pick one of the list icons");
  return icon;
}
