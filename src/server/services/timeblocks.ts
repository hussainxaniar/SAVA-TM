import { db } from "../db";
import { AppError } from "../errors";
import { requireMember, spaceIdOfTask } from "../guards";
import { logActivity } from "./activity";
import { loadTaskRows } from "./task-rows";
import type { Ctx, DueChipDTO, MyTaskDTO, TimeBlockDTO } from "./types";

/*
 * Section 8.6 / 10.1, local half (T-17). A task can be scheduled into any number of slots; each
 * slot belongs to the user whose calendar it's on, and only that user moves or removes it.
 * Writes log SCHEDULED { timeBlockId, start, end } / UNSCHEDULED { timeBlockId }. Blocks are saved
 * PENDING; pushing them to Google (and SYNCED / ERROR) arrives with T-18.
 */

const MIN_MINUTES = 15;
const MAX_MINUTES = 24 * 60;
const MAX_RANGE_DAYS = 62; // a month view plus its leading/trailing weeks, with room to spare

const blockSelect = {
  id: true,
  taskId: true,
  start: true,
  end: true,
  syncState: true,
  lastSyncError: true,
  task: { select: { title: true, completedAt: true, project: { select: { color: true } } } },
} as const;

type BlockRecord = {
  id: string;
  taskId: string;
  start: Date;
  end: Date;
  syncState: TimeBlockDTO["syncState"];
  lastSyncError: string | null;
  task: { title: string; completedAt: Date | null; project: { color: string } };
};

function toBlock(b: BlockRecord): TimeBlockDTO {
  return {
    id: b.id,
    taskId: b.taskId,
    taskTitle: b.task.title,
    projectColor: b.task.project.color,
    completed: b.task.completedAt !== null,
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    syncState: b.syncState,
    lastSyncError: b.lastSyncError,
  };
}

/** My blocks in this space overlapping [rangeStart, rangeEnd), on live tasks. */
export async function listTimeBlocks(
  ctx: Ctx,
  input: { spaceId: string; rangeStart: string; rangeEnd: string },
): Promise<TimeBlockDTO[]> {
  await requireMember(ctx.userId, input.spaceId);
  const { start, end } = checkRange(input.rangeStart, input.rangeEnd);
  const rows = await db.timeBlock.findMany({
    where: {
      userId: ctx.userId,
      spaceId: input.spaceId,
      start: { lt: end },
      end: { gt: start },
      task: { deletedAt: null },
    },
    orderBy: { start: "asc" },
    select: blockSelect,
  });
  return rows.map(toBlock);
}

/**
 * The calendar's "Unscheduled" rail: open, live tasks assigned to me (outside archived projects
 * and lists) with none of my blocks ending in the future. Optionally one project.
 */
export async function listUnscheduled(ctx: Ctx, input: { spaceId: string; projectId?: string | null }): Promise<MyTaskDTO[]> {
  await requireMember(ctx.userId, input.spaceId);
  const { rows, records } = await loadTaskRows(db, {
    spaceId: input.spaceId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    completedAt: null,
    assignees: { some: { userId: ctx.userId } },
    project: { archivedAt: null },
    homeList: { archivedAt: null },
    timeBlocks: { none: { userId: ctx.userId, end: { gt: new Date() } } },
  });
  const [projects, lists] = await Promise.all([
    db.project.findMany({
      where: { id: { in: [...new Set(records.map((r) => r.projectId))] } },
      select: { id: true, name: true, color: true },
    }),
    db.list.findMany({ where: { id: { in: [...new Set(records.map((r) => r.homeListId))] } }, select: { id: true, name: true } }),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const listById = new Map(lists.map((l) => [l.id, l]));
  const projectOf = new Map(records.map((r) => [r.id, r.projectId]));
  return rows.map((row) => {
    const project = projectById.get(projectOf.get(row.id)!)!;
    return { ...row, projectId: project.id, projectName: project.name, projectColor: project.color, listName: listById.get(row.homeListId)!.name };
  });
}

/** All-day chips (10.1): open tasks assigned to me with a date-only due date in the range. */
export async function listDueChips(
  ctx: Ctx,
  input: { spaceId: string; rangeStart: string; rangeEnd: string },
): Promise<DueChipDTO[]> {
  await requireMember(ctx.userId, input.spaceId);
  const { start, end } = checkRange(input.rangeStart, input.rangeEnd);
  // Date-only dues are UTC midnight of their day: widen by a day each side so every local day
  // in the range is covered; the client places chips by calendar day.
  const day = 86_400_000;
  const tasks = await db.task.findMany({
    where: {
      spaceId: input.spaceId,
      deletedAt: null,
      completedAt: null,
      dueHasTime: false,
      dueDate: { gte: new Date(start.getTime() - day), lt: new Date(end.getTime() + day) },
      assignees: { some: { userId: ctx.userId } },
      project: { archivedAt: null },
      homeList: { archivedAt: null },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
    select: { id: true, title: true, dueDate: true, project: { select: { color: true } } },
  });
  return tasks.map((t) => ({ taskId: t.id, title: t.title, dueDate: t.dueDate!.toISOString(), projectColor: t.project.color }));
}

/** Schedules a slot for the caller on a live task they can see. `timeZone` is the browser's (T-18 sends it to Google). */
export async function createTimeBlock(
  ctx: Ctx,
  input: { taskId: string; start: string; end: string; timeZone: string },
): Promise<TimeBlockDTO> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);
  const { start, end } = checkSlot(input.start, input.end, input.timeZone);

  return db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: input.taskId, deletedAt: null }, select: { id: true } });
    if (!task) throw new AppError("NOT_FOUND", "Task not found");
    const block = await tx.timeBlock.create({
      data: { taskId: task.id, userId: ctx.userId, spaceId, start, end },
      select: blockSelect,
    });
    await logActivity(tx, {
      spaceId,
      taskId: task.id,
      actorId: ctx.userId,
      type: "SCHEDULED",
      payload: { timeBlockId: block.id, start: block.start.toISOString(), end: block.end.toISOString() },
    });
    return toBlock(block);
  });
}

/** Moves or resizes one of the caller's own blocks. Logs SCHEDULED with the new slot. */
export async function updateTimeBlock(
  ctx: Ctx,
  input: { timeBlockId: string; start: string; end: string; timeZone: string },
): Promise<TimeBlockDTO> {
  const owned = await ownBlock(ctx, input.timeBlockId);
  const { start, end } = checkSlot(input.start, input.end, input.timeZone);
  return db.$transaction(async (tx) => {
    const block = await tx.timeBlock.update({
      where: { id: owned.id },
      // A moved block needs pushing again (T-18).
      data: { start, end, syncState: "PENDING", lastSyncError: null },
      select: blockSelect,
    });
    await logActivity(tx, {
      spaceId: owned.spaceId,
      taskId: block.taskId,
      actorId: ctx.userId,
      type: "SCHEDULED",
      payload: { timeBlockId: block.id, start: block.start.toISOString(), end: block.end.toISOString() },
    });
    return toBlock(block);
  });
}

/** Removes one of the caller's own blocks ("Remove from calendar"). Logs UNSCHEDULED. */
export async function deleteTimeBlock(ctx: Ctx, input: { timeBlockId: string }): Promise<void> {
  const owned = await ownBlock(ctx, input.timeBlockId);
  await db.$transaction(async (tx) => {
    await tx.timeBlock.delete({ where: { id: owned.id } });
    await logActivity(tx, {
      spaceId: owned.spaceId,
      taskId: owned.taskId,
      actorId: ctx.userId,
      type: "UNSCHEDULED",
      payload: { timeBlockId: owned.id },
    });
  });
}

// ---------- helpers ----------

/** The block, if it exists and the caller is a member of its space; someone else's is FORBIDDEN. */
async function ownBlock(ctx: Ctx, timeBlockId: string) {
  const block = await db.timeBlock.findUnique({
    where: { id: timeBlockId },
    select: { id: true, userId: true, spaceId: true, taskId: true },
  });
  if (!block) throw new AppError("NOT_FOUND", "Time block not found");
  await requireMember(ctx.userId, block.spaceId);
  if (block.userId !== ctx.userId) throw new AppError("FORBIDDEN", "You can only change your own calendar");
  return block;
}

function parseInstant(value: string, label: string): Date {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new AppError("VALIDATION", `${label} isn't a valid time`);
  return d;
}

function checkSlot(startValue: string, endValue: string, timeZone: string) {
  const start = parseInstant(startValue, "Start");
  const end = parseInstant(endValue, "End");
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (minutes < MIN_MINUTES) throw new AppError("VALIDATION", "A time slot needs at least 15 minutes");
  if (minutes > MAX_MINUTES) throw new AppError("VALIDATION", "A time slot can't be longer than a day");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new AppError("VALIDATION", "Unknown time zone");
  }
  return { start, end };
}

function checkRange(startValue: string, endValue: string) {
  const start = parseInstant(startValue, "Range start");
  const end = parseInstant(endValue, "Range end");
  if (end <= start || end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new AppError("VALIDATION", "Pick a shorter date range");
  }
  return { start, end };
}
