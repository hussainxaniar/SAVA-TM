import type { Prisma } from "@prisma/client";
import { comparePositions } from "@/lib/position";
import { db } from "../db";
import { toStatusDTO } from "./statuses";
import type { Priority, TaskRowDTO } from "./types";

// Builds TaskRowDTOs (8.1) for any set of tasks. Soft-deleted tasks are always excluded (6.4.5).

export type DbClient = Prisma.TransactionClient | typeof db;

const live = { deletedAt: null };

export const taskRowSelect = {
  id: true,
  title: true,
  priority: true,
  completedAt: true,
  startDate: true,
  dueDate: true,
  dueHasTime: true,
  parentId: true,
  depth: true,
  homeListId: true,
  projectId: true,
  position: true,
  status: true,
  parent: { select: { title: true } },
  assignees: {
    orderBy: { assignedAt: "asc" },
    select: { user: { select: { id: true, name: true, image: true } } },
  },
  _count: { select: { subtasks: { where: live }, comments: { where: live } } },
} satisfies Prisma.TaskSelect;

export type TaskRowRecord = Prisma.TaskGetPayload<{ select: typeof taskRowSelect }>;

/**
 * Rows for tasks matching `where`, sorted by their (context) position.
 * `listContext` makes rows list-relative: a task linked into that list (and not home there)
 * gets isLinkedHere + the link's position.
 */
export async function loadTaskRows(
  client: DbClient,
  where: Prisma.TaskWhereInput,
  listContext?: { listId: string; linkPositions: Map<string, string> },
): Promise<{ rows: TaskRowDTO[]; records: TaskRowRecord[] }> {
  const records = await client.task.findMany({ where: { ...where, ...live }, select: taskRowSelect });
  const open = await openSubtaskCounts(client, records.map((r) => r.id));
  const rows = records
    .map((r) => toTaskRow(r, open.get(r.id) ?? 0, listContext))
    .sort((a, b) => comparePositions(a.position, b.position));
  return { rows, records };
}

export function toTaskRow(
  r: TaskRowRecord,
  openSubtaskCount: number,
  listContext?: { listId: string; linkPositions: Map<string, string> },
): TaskRowDTO {
  const linkPosition =
    listContext && r.homeListId !== listContext.listId ? listContext.linkPositions.get(r.id) : undefined;
  return {
    id: r.id,
    title: r.title,
    priority: r.priority as Priority,
    status: toStatusDTO(r.status),
    completedAt: r.completedAt?.toISOString() ?? null,
    startDate: r.startDate?.toISOString() ?? null,
    dueDate: r.dueDate?.toISOString() ?? null,
    dueHasTime: r.dueHasTime,
    assignees: r.assignees.map((a) => a.user),
    parentId: r.parentId,
    parentTitle: r.parent?.title ?? null,
    depth: r.depth,
    homeListId: r.homeListId,
    isLinkedHere: linkPosition !== undefined,
    subtaskCount: r._count.subtasks,
    openSubtaskCount,
    commentCount: r._count.comments,
    position: linkPosition ?? r.position,
  };
}

async function openSubtaskCounts(client: DbClient, parentIds: string[]): Promise<Map<string, number>> {
  if (parentIds.length === 0) return new Map();
  const groups = await client.task.groupBy({
    by: ["parentId"],
    where: { parentId: { in: parentIds }, completedAt: null, ...live },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.parentId!, g._count._all]));
}
